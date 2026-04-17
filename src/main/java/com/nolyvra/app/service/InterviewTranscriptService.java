package com.nolyvra.app.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.InterviewTranscriptResponse;
import com.nolyvra.app.model.InterviewTranscriptResponse.NotableMoment;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import com.openai.models.chat.completions.ChatCompletionSystemMessageParam;
import com.openai.models.chat.completions.ChatCompletionUserMessageParam;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class InterviewTranscriptService {

    private final JdbcTemplate jdbc;
    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final String model;

    public InterviewTranscriptService(
            JdbcTemplate jdbc,
            OpenAIClient openAI,
            ObjectMapper objectMapper,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.jdbc = jdbc;
        this.openAI = openAI;
        this.objectMapper = objectMapper;
        this.model = model;
    }

    // ─── Submit transcript and run AI analysis ────────────────────────────────

    public InterviewTranscriptResponse analyseTranscript(
            String candidateId, String loginId,
            String interviewId, String transcriptText) {

        String cvAnalysisContext = loadCvAnalysisSummary(candidateId);
        String candidateName     = loadCandidateName(candidateId);
        InterviewMeta meta       = loadInterviewMeta(interviewId);

        String rawJson = callOpenAI(buildSystemPrompt(), buildUserPrompt(transcriptText, cvAnalysisContext, candidateName, meta));

        JsonNode root;
        try {
            root = objectMapper.readTree(rawJson);
        } catch (Exception e) {
            throw new IllegalStateException("OpenAI returned non-JSON: " + rawJson, e);
        }

        String id          = "itrans-" + UUID.randomUUID();
        Instant now        = Instant.now();
        OffsetDateTime nowOdt = OffsetDateTime.ofInstant(now, ZoneOffset.UTC);

        Object[] params = {
                id, interviewId, candidateId, loginId,
                transcriptText, "MANUAL", nowOdt,
                textField(root, "overallSentiment"),
                intField(root, "sentimentScore"),
                intField(root, "communicationScore"),
                intField(root, "technicalScore"),
                intField(root, "culturalFitScore"),
                textField(root, "confidenceLevel"),
                safeJsonArray(root, "keyStrengths"),
                safeJsonArray(root, "areasOfConcern"),
                safeJsonArray(root, "notableMoments"),
                safeJsonArray(root, "cvAlignmentInsights"),
                textField(root, "interviewSummary"),
                textField(root, "hiringRecommendation"),
                rawJson, nowOdt
        };

        // Use upsert only when linked to a specific interview; plain insert otherwise
        // (ON CONFLICT on a nullable column requires a non-null value to trigger)
        String sql = interviewId != null ? """
                insert into interview_transcripts (
                    id, interview_id, candidate_id, login_id,
                    transcript_text, transcript_source, fetched_at,
                    overall_sentiment, sentiment_score,
                    communication_score, technical_score, cultural_fit_score,
                    confidence_level, key_strengths, areas_of_concern,
                    notable_moments, cv_alignment_insights,
                    interview_summary, hiring_recommendation,
                    analysis_json, analyzed_at
                ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,?,?::jsonb,?)
                on conflict (interview_id) do update set
                    transcript_text         = excluded.transcript_text,
                    transcript_source       = excluded.transcript_source,
                    fetched_at              = excluded.fetched_at,
                    overall_sentiment       = excluded.overall_sentiment,
                    sentiment_score         = excluded.sentiment_score,
                    communication_score     = excluded.communication_score,
                    technical_score         = excluded.technical_score,
                    cultural_fit_score      = excluded.cultural_fit_score,
                    confidence_level        = excluded.confidence_level,
                    key_strengths           = excluded.key_strengths,
                    areas_of_concern        = excluded.areas_of_concern,
                    notable_moments         = excluded.notable_moments,
                    cv_alignment_insights   = excluded.cv_alignment_insights,
                    interview_summary       = excluded.interview_summary,
                    hiring_recommendation   = excluded.hiring_recommendation,
                    analysis_json           = excluded.analysis_json,
                    analyzed_at             = excluded.analyzed_at
                returning id
                """ : """
                insert into interview_transcripts (
                    id, interview_id, candidate_id, login_id,
                    transcript_text, transcript_source, fetched_at,
                    overall_sentiment, sentiment_score,
                    communication_score, technical_score, cultural_fit_score,
                    confidence_level, key_strengths, areas_of_concern,
                    notable_moments, cv_alignment_insights,
                    interview_summary, hiring_recommendation,
                    analysis_json, analyzed_at
                ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,?,?::jsonb,?)
                returning id
                """;

        String persistedId = jdbc.queryForObject(sql, String.class, params);

        return getById(persistedId != null ? persistedId : id);
    }

    // ─── GET existing analyses ────────────────────────────────────────────────

    public List<InterviewTranscriptResponse> getAllForCandidate(String candidateId, String loginId) {
        return jdbc.query("""
                select it.*, i.interview_type, i.interviewer, i.scheduled_at, i.meeting_link
                from interview_transcripts it
                left join interviews i on i.id = it.interview_id
                where it.candidate_id = ? and it.login_id = ?
                order by it.analyzed_at desc nulls last
                """, (rs, n) -> mapRow(rs), candidateId, loginId);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private InterviewTranscriptResponse getById(String id) {
        return jdbc.query("""
                select it.*, i.interview_type, i.interviewer, i.scheduled_at, i.meeting_link
                from interview_transcripts it
                left join interviews i on i.id = it.interview_id
                where it.id = ?
                """, rs -> { rs.next(); return mapRow(rs); }, id);
    }

    private InterviewTranscriptResponse mapRow(ResultSet rs) throws SQLException {
        return new InterviewTranscriptResponse(
                rs.getString("id"),
                rs.getString("interview_id"),
                rs.getString("candidate_id"),
                safeCol(rs, "interview_type"),
                safeCol(rs, "interviewer"),
                toInstant(rs, "scheduled_at"),
                safeCol(rs, "meeting_link"),
                rs.getString("transcript_source"),
                toInstant(rs, "fetched_at"),
                rs.getString("overall_sentiment"),
                rs.getObject("sentiment_score")    != null ? rs.getInt("sentiment_score")    : null,
                rs.getObject("communication_score") != null ? rs.getInt("communication_score") : null,
                rs.getObject("technical_score")    != null ? rs.getInt("technical_score")    : null,
                rs.getObject("cultural_fit_score") != null ? rs.getInt("cultural_fit_score") : null,
                rs.getString("confidence_level"),
                parseStringList(rs.getString("key_strengths")),
                parseStringList(rs.getString("areas_of_concern")),
                parseNotableMoments(rs.getString("notable_moments")),
                parseStringList(rs.getString("cv_alignment_insights")),
                rs.getString("interview_summary"),
                rs.getString("hiring_recommendation"),
                toInstant(rs, "analyzed_at"),
                toInstant(rs, "created_at")
        );
    }

    private Instant toInstant(ResultSet rs, String col) {
        try {
            OffsetDateTime odt = rs.getObject(col, OffsetDateTime.class);
            return odt != null ? odt.toInstant() : null;
        } catch (Exception e) { return null; }
    }

    private String safeCol(ResultSet rs, String col) {
        try { return rs.getString(col); } catch (Exception e) { return null; }
    }

    private String loadCvAnalysisSummary(String candidateId) {
        return jdbc.query("""
                select consistency_score, capability_score, risk_level, ai_summary_json
                from analyses
                where candidate_id = ?
                order by analyzed_at desc nulls last
                limit 1
                """, rs -> {
            if (!rs.next()) return null;
            try {
                StringBuilder sb = new StringBuilder("CV Analysis Results:\n");
                sb.append("- Consistency Score: ").append(rs.getObject("consistency_score")).append("/100\n");
                sb.append("- Capability Match Score: ").append(rs.getObject("capability_score")).append("/100\n");
                sb.append("- Risk Level: ").append(rs.getString("risk_level")).append("\n");
                String summaryJson = rs.getString("ai_summary_json");
                if (summaryJson != null) {
                    JsonNode node = objectMapper.readTree(summaryJson);
                    if (node.has("professionalSummary"))
                        sb.append("- AI Summary: ").append(node.get("professionalSummary").asText()).append("\n");
                    if (node.has("strengths"))
                        sb.append("- CV Strengths: ").append(node.get("strengths")).append("\n");
                    if (node.has("concerns"))
                        sb.append("- CV Concerns: ").append(node.get("concerns")).append("\n");
                }
                return sb.toString();
            } catch (Exception e) {
                return "CV analysis available but could not be parsed.";
            }
        }, candidateId);
    }

    private String loadCandidateName(String candidateId) {
        return jdbc.query("select name from candidates where id = ?",
                rs -> rs.next() ? rs.getString("name") : "Candidate",
                candidateId);
    }

    private record InterviewMeta(String interviewType, String interviewer) {}

    private InterviewMeta loadInterviewMeta(String interviewId) {
        if (interviewId == null) return new InterviewMeta(null, null);
        return jdbc.query("select interview_type, interviewer from interviews where id = ?",
                rs -> rs.next()
                        ? new InterviewMeta(rs.getString("interview_type"), rs.getString("interviewer"))
                        : new InterviewMeta(null, null),
                interviewId);
    }

    private String buildSystemPrompt() {
        return """
                You are an expert hiring assessor with 15+ years of experience evaluating candidates across technical and business roles.

                Your task is to analyse interview transcripts and provide a structured, objective, and evidence-based assessment of the candidate.

                You MUST:
                - Avoid generic summaries
                - Base every evaluation on actual statements from the transcript
                - Highlight both strengths and weaknesses
                - Detect inconsistencies, vagueness, or overuse of buzzwords
                - Evaluate communication, clarity, and thinking depth

                Be precise, structured, and critical where necessary.
                """;
    }

    private String buildUserPrompt(String transcript, String cvContext,
                                   String candidateName, InterviewMeta meta) {
        StringBuilder sb = new StringBuilder();
        sb.append("Analyse the following interview transcript");
        if (candidateName != null) sb.append(" for candidate ").append(candidateName);
        if (meta.interviewType() != null) sb.append(" (").append(meta.interviewType()).append(" interview)");
        sb.append(".\n\n");

        if (cvContext != null) {
            sb.append("EXISTING CV ANALYSIS CONTEXT:\n").append(cvContext).append("\n\n");
            sb.append("Use this context to identify alignment or discrepancies between CV claims and interview performance.\n\n");
        }

        sb.append("INTERVIEW TRANSCRIPT:\n---\n").append(transcript).append("\n---\n\n");

        sb.append("""
                Perform a structured evaluation covering:

                1. Communication Skills (0–100): clarity of expression, structure, conciseness vs verbosity, confidence indicators
                2. Answer Quality (0–100): relevance, depth of knowledge, practical vs theoretical, problem-solving, specific examples cited
                3. Behavioural & Professional Fit (0–100): ownership, leadership/initiative, collaboration mindset, authenticity vs scripted
                4. Consistency Check: contradictions, mismatch between claims and explanations, gaps in experience
                5. Risk Flags: vague answers, buzzword-heavy responses, avoidance, lack of depth
                6. Strengths: top 3–5 based on evidence from the transcript
                7. Weaknesses / Development Areas: top 3–5 gaps with evidence
                8. Overall Recommendation: one of "Strong Hire" | "Hire" | "Borderline" | "No Hire"
                9. Evaluation Confidence (0–100): how confident you are given the transcript quality and depth

                Return ONLY a JSON object with exactly these fields (no markdown, no extra text):
                {
                  "overallSentiment": "Positive" | "Neutral" | "Negative",
                  "sentimentScore": <integer 0-100, from section 9: evaluation confidence>,
                  "communicationScore": <integer 0-100, from section 1>,
                  "technicalScore": <integer 0-100, from section 2: answer quality — 0 if non-technical interview>,
                  "culturalFitScore": <integer 0-100, from section 3: behavioural fit>,
                  "confidenceLevel": "High" | "Medium" | "Low" (derived from sentimentScore: >=70 High, >=40 Medium, else Low),
                  "keyStrengths": ["<evidence-backed strength>", ...],
                  "areasOfConcern": ["<risk flag or weakness with evidence>", ...],
                  "notableMoments": [
                    {"speaker": "Candidate|Interviewer", "quote": "<exact or paraphrased quote>", "significance": "<why this matters>"}
                  ],
                  "cvAlignmentInsights": ["<consistency finding or CV vs interview gap>", ...],
                  "interviewSummary": "<2-4 sentence critical narrative — avoid generic praise>",
                  "hiringRecommendation": "Strong Hire" | "Hire" | "Borderline" | "No Hire"
                }

                Notes:
                - cvAlignmentInsights: populate from section 4 ([] if no CV context provided)
                - notableMoments: 2-4 quotes best illustrating performance (positive and negative)
                - areasOfConcern: merge sections 5 and 7 into a single evidence-backed list
                - overallSentiment: derive from the overall tone and hiring recommendation
                """);
        return sb.toString();
    }

    private String callOpenAI(String systemPrompt, String userPrompt) {
        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .temperature(0.2)
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
        // Strip markdown code fences if present
        if (raw.startsWith("```")) {
            raw = raw.replaceAll("^```(?:json)?\\s*", "").replaceAll("\\s*```$", "").trim();
        }
        return raw;
    }

    private String textField(JsonNode root, String field) {
        JsonNode n = root.get(field);
        return (n != null && !n.isNull()) ? n.asText() : null;
    }

    private Integer intField(JsonNode root, String field) {
        JsonNode n = root.get(field);
        return (n != null && !n.isNull() && n.isNumber()) ? n.intValue() : null;
    }

    private String safeJsonArray(JsonNode root, String field) {
        JsonNode n = root.get(field);
        return (n != null && n.isArray()) ? n.toString() : "[]";
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return Collections.emptyList(); }
    }

    private List<NotableMoment> parseNotableMoments(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return Collections.emptyList(); }
    }
}
