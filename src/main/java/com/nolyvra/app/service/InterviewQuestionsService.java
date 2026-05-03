package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import com.openai.models.chat.completions.ChatCompletionSystemMessageParam;
import com.openai.models.chat.completions.ChatCompletionUserMessageParam;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InterviewQuestionsService {

    private final JdbcTemplate jdbc;
    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final String model;
    private final TokenService tokenService;

    public InterviewQuestionsService(
            JdbcTemplate jdbc,
            OpenAIClient openAI,
            ObjectMapper objectMapper,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.jdbc = jdbc;
        this.openAI = openAI;
        this.objectMapper = objectMapper;
        this.tokenService = tokenService;
        this.model = model;
    }

    // ─── Generate questions via OpenAI ────────────────────────────────────────

    public String generateQuestions(String candidateId, String loginId) {
        if (!tokenService.deductToken(loginId))
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Insufficient tokens");
        CandidateContext ctx = loadContext(candidateId, loginId);
        String result = callOpenAI(buildSystemPrompt(), buildUserPrompt(ctx));
        return result;
    }

    // ─── Save questions to candidates table ──────────────────────────────────

    public void saveQuestions(String candidateId, String loginId, String questions) {
        int rows = jdbc.update("""
                update candidates set interview_questions = ?
                where id = ? and login_id = ?
                """, questions, candidateId, loginId);
        if (rows == 0) throw new IllegalArgumentException("Candidate not found: " + candidateId);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private record CandidateContext(
            String candidateName,
            String cvText,
            String jobTitle,
            String jdText,
            String analysisQuestions  // existing AI-suggested questions from analysis_json, may be null
    ) {}

    private CandidateContext loadContext(String candidateId, String loginId) {
        return jdbc.query("""
                select c.name, c.cv_text, coalesce(j.title,'') as job_title,
                       coalesce(j.jd_text,'') as jd_text,
                       a.analysis_json
                from candidates c
                left join jobs j on j.id = c.job_id
                left join lateral (
                    select analysis_json from analyses
                    where candidate_id = c.id
                    order by analyzed_at desc limit 1
                ) a on true
                where c.id = ? and c.login_id = ?
                """, rs -> {
            if (!rs.next()) throw new IllegalArgumentException("Candidate not found: " + candidateId);
            String analysisQs = extractSuggestedQuestions(rs.getString("analysis_json"));
            return new CandidateContext(
                    rs.getString("name"),
                    rs.getString("cv_text"),
                    rs.getString("job_title"),
                    rs.getString("jd_text"),
                    analysisQs);
        }, candidateId, loginId);
    }

    private String extractSuggestedQuestions(String analysisJson) {
        if (analysisJson == null) return null;
        try {
            JsonNode root = objectMapper.readTree(analysisJson);
            JsonNode qs   = root.get("suggestedQuestions");
            if (qs == null || !qs.isArray() || qs.isEmpty()) return null;
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < qs.size(); i++) {
                JsonNode q = qs.get(i);
                sb.append(i + 1).append(". ").append(q.path("question").asText()).append("\n");
            }
            return sb.toString().trim();
        } catch (Exception e) {
            return null;
        }
    }

    private String buildSystemPrompt() {
        return """
                You are an expert technical interviewer and hiring manager with deep experience in evaluating candidates across multiple domains.

                Your goal is to generate highly targeted, role-specific interview questions based on:
                - Job Description (JD)
                - Candidate CV

                You MUST:
                - Identify gaps, inconsistencies, and strengths
                - Generate questions that validate real experience, not theoretical knowledge
                - Avoid generic or textbook questions
                - Prioritize questions that uncover depth, ownership, and real-world problem solving
                - Include probing follow-ups where necessary

                Think like a hiring manager trying to avoid a bad hire.
                """;
    }

    private String buildUserPrompt(CandidateContext ctx) {
        StringBuilder sb = new StringBuilder();
        sb.append("Generate structured interview questions for the following candidate.\n\n");
        sb.append("CANDIDATE: ").append(ctx.candidateName()).append("\n");
        sb.append("ROLE: ").append(ctx.jobTitle().isBlank() ? "Not specified" : ctx.jobTitle()).append("\n\n");

        if (ctx.cvText() != null && !ctx.cvText().isBlank()) {
            sb.append("CANDIDATE CV:\n---\n")
              .append(ctx.cvText().length() > 3000 ? ctx.cvText().substring(0, 3000) + "..." : ctx.cvText())
              .append("\n---\n\n");
        }

        if (!ctx.jdText().isBlank()) {
            sb.append("JOB DESCRIPTION:\n---\n")
              .append(ctx.jdText().length() > 2000 ? ctx.jdText().substring(0, 2000) + "..." : ctx.jdText())
              .append("\n---\n\n");
        }

        sb.append("""
                Perform the following:

                1. Identify Key Skills Required for the Role
                2. Identify Candidate Strength Areas
                3. Identify Gaps / Risks / Mismatches between JD and CV

                Then generate interview questions grouped into:

                A. Core Skill Validation Questions (5–7)
                - Focus on key technical/functional skills required for the role
                - Questions must require real experience, not theory

                B. Gap & Risk-Based Questions (3–5)
                - Target missing skills, inconsistencies, or weak areas
                - Force the candidate to clarify or justify

                C. Experience Deep-Dive Questions (3–5)
                - Based on past roles/projects mentioned in the CV
                - Focus on ownership, decisions, and measurable outcomes

                D. Behavioural & Situational Questions (3–4)
                - Evaluate problem-solving, conflict handling, leadership, accountability

                E. Authenticity Check Questions (2–3)
                - Detect rehearsed or AI-generated answers
                - Ask for specifics, edge cases, or unexpected details

                F. Communication & Cultural Fit Questions (5–7)
                - Clarity of communication and structured thinking
                - Ability to explain complex ideas simply
                - Stakeholder communication and influence
                - Team collaboration and conflict handling
                - Adaptability, learning mindset, professional maturity
                - Must be open-ended, require real examples, encourage storytelling (STAR)
                - Avoid generic questions like "Are you a team player?"

                For at least 3 questions in each category, include 1–2 follow-up probing questions.

                Return ONLY a JSON object with exactly this structure (no markdown, no extra text):
                {
                  "skillsRequired": ["<skill>", ...],
                  "candidateStrengths": ["<CV-backed strength>", ...],
                  "identifiedGaps": ["<gap or mismatch>", ...],
                  "questions": {
                    "coreSkills": [{"question": "<string>", "followUps": ["<probe>", ...]}, ...],
                    "gapBased": [{"question": "<string>", "followUps": ["<probe>", ...]}, ...],
                    "experienceDeepDive": [{"question": "<string>", "followUps": ["<probe>", ...]}, ...],
                    "behavioural": [{"question": "<string>", "followUps": ["<probe>", ...]}, ...],
                    "authenticityCheck": [{"question": "<string>", "followUps": ["<probe>", ...]}, ...],
                    "communicationCultural": [{"question": "<string>", "followUps": ["<probe>", ...]}, ...]
                  }
                }

                Rules:
                - followUps is an empty array [] if no follow-up is needed for that question
                - All questions must be specific to this candidate and role
                - Never use generic questions like "Tell me about yourself"
                """);

        return sb.toString();
    }

    private String callOpenAI(String systemPrompt, String userPrompt) {
        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .temperature(0.4)
                .addMessage(ChatCompletionSystemMessageParam.builder()
                        .content(systemPrompt)
                        .build())
                .addMessage(ChatCompletionUserMessageParam.builder()
                        .content(userPrompt)
                        .build())
                .build();
        String raw = openAI.chat().completions().create(params)
                .choices().getFirst()
                .message().content().orElseThrow()
                .trim();
        if (raw.startsWith("```")) {
            raw = raw.replaceAll("^```(?:json)?\\s*", "").replaceAll("\\s*```$", "").trim();
        }
        return raw;
    }
}
