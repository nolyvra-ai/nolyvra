package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AnalysisService {

    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final String model;
    private final JdbcTemplate jdbc;
    private final TokenService tokenService;
    private final Map<String, CandidateAnalysisResponse> cache = new ConcurrentHashMap<>();

    public AnalysisService(
            ObjectMapper objectMapper,
            OpenAIClient openAIClient,
            JdbcTemplate jdbcTemplate,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.objectMapper = objectMapper;
        this.openAI = openAIClient;
        this.jdbc = jdbcTemplate;
        this.tokenService = tokenService;
        this.model = model;
    }

    // ─── Loaders ──────────────────────────────────────────────────────────────

    private String loadJobDescriptionFromDb(String jobId) {
        return jdbc.query("select jd_text from jobs where id = ?",
                (rs, r) -> rs.getString("jd_text"), jobId)
                .stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
    }

    private String loadCvTextFromDb(String candidateId) {
        return jdbc.query("select cv_text from candidates where id = ?",
                (rs, r) -> rs.getString("cv_text"), candidateId)
                .stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found: " + candidateId));
    }

    private String loadLinkedinUrlFromDb(String candidateId) {
        return jdbc.query("select linkedin_url from candidates where id = ?",
                (rs, r) -> rs.getString("linkedin_url"), candidateId)
                .stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found: " + candidateId));
    }

    // ─── Core analysis ────────────────────────────────────────────────────────
    // MVP2: expanded OpenAI prompt now returns all fields in one call.
    // No extra API calls needed for matchedSkills, strengthSignals, aiVerdict etc.

    public CandidateAnalysisResponse analyze(String candidateId,
            CandidateResponse candidateResponse, String loginId) {

        String jdText = loadJobDescriptionFromDb(candidateResponse.jobId());
        String cvText = loadCvTextFromDb(candidateId);
        String linkedinUrl = loadLinkedinUrlFromDb(candidateId);

        try {
            String systemPrompt = """
                    You are an expert technical recruiter and senior software architect.
                    Return EXACTLY ONE JSON object. No markdown. No extra keys.

                    {
                      "scores": {
                        "consistencyScore": 0-100,
                        "capabilityScore": 0-100,
                        "riskLevel": "Low|Medium|High"
                      },

                      "consistency": {
                        "timelineMatchPercent": 0-100,
                        "flags": [
                          { "severity": "Low|Medium|High", "type": "DATE_MISMATCH|TITLE_MISMATCH|MISSING_ROLE|OTHER", "message": "..." }
                        ]
                      },

                      "consistencyBreakdown": [
                        { "label": "Employment Timeline", "match": true,  "note": null, "score": 95 },
                        { "label": "Job Titles",          "match": true,  "note": null, "score": 90 },
                        { "label": "Skills Listed",       "match": false, "note": "Partial overlap", "score": 70 },
                        { "label": "Education",           "match": true,  "note": null, "score": 100 }
                      ],

                      "capabilityMatrix": {
                        "rows": [
                          { "capability": "...", "weightPercent": 25, "scorePercent": 0-100, "gapLevel": "Low|Medium|High" }
                        ],
                        "weights": { "System Design": 25, "Cloud Architecture": 25, "Leadership": 25, "Domain Knowledge": 25 }
                      },

                      "matchedSkills": ["skill1", "skill2"],
                      "missingSkills": ["skill1", "skill2"],

                      "strengthSignals": [
                        { "icon": "⭐", "title": "...", "description": "...", "tag": "optional badge label" }
                      ],

                      "executionTier": 1,
                      "executionTierNote": "...",

                      "suggestedQuestions": [
                        {
                            "order": 1,
                            "type": "system_design|architecture|behavioral|debugging|leadership|domain",
                            "intent": "2-4 sentence explanation of exactly what this question is probing for, why it is relevant to this specific candidate's risk flags or gaps, and what a strong vs weak answer would reveal about their suitability for this role.",
                            "question": "..."
                        }
                        ],

                      "riskFlags": ["..."],
                      "recommendation": "...",

                      "aiVerdict": { "title": "Strong Hire|Proceed with Caution|Do Not Progress", "summary": "1-2 sentences." },
                      "aiConfidence": "Low|Medium|High",
                      "aiConfidenceNote": "Brief reason for this confidence level"
                    }

                    Hard requirements:
                    - weights must sum to 100: System Design, Cloud Architecture, Leadership, Domain Knowledge.
                    - capabilityMatrix.rows must have exactly those 4 capabilities.
                    - suggestedQuestions: exactly 6 items, order 1-6.
                    - intent: must be 2-4 sentences. Explain specifically what competency or risk is being probed, why it matters for this role, and what the interviewer should listen for in the response.
                    - riskFlags: 3-6 items.
                    - matchedSkills: skills from JD evidenced in CV. Max 10.
                    - missingSkills: skills from JD absent or weak in CV. Max 8.
                    - consistencyBreakdown: exactly 4 items covering Employment Timeline, Job Titles, Skills Listed, Education.
                    - strengthSignals: 3-5 items. Use relevant emojis for icon.
                    - executionTier: integer 1 (Contributor), 2 (Owner), 3 (Architect), 4 (Strategic Lead).
                    - aiVerdict.title must be exactly one of: "Strong Hire", "Proceed with Caution", "Do Not Progress".
                    """;

            String userPrompt = """
                    JOB DESCRIPTION:
                    %s

                    CV:
                    %s

                    LINKEDIN:
                    %s

                    Now return the analysis JSON ONLY in the required schema.
                    """.formatted(
                    safeTrim(jdText, 10000),
                    safeTrim(cvText, 10000),
                    safeTrim(linkedinUrl, 10000));

            var params = ChatCompletionCreateParams.builder()
                    .model(model)
                    .addSystemMessage(systemPrompt)
                    .addUserMessage(userPrompt)
                    .temperature(0.2)
                    .build();

            var completion = openAI.chat().completions().create(params);
            tokenService.deductToken(loginId);
            String content = completion.choices().getFirst().message().content()
                    .orElseThrow(() -> new IllegalStateException("Model returned empty content"));

            AiAnalysisResult ai = objectMapper.readValue(cleanJson(content), AiAnalysisResult.class);

            CandidateAnalysisResponse response = new CandidateAnalysisResponse(
                    candidateId,
                    candidateResponse.jobId(),
                    Instant.now(),
                    ai.scores(),
                    ai.consistency(),
                    ai.capabilityMatrix(),
                    ai.suggestedQuestions(),
                    ai.riskFlags(),
                    ai.recommendation(),
                    candidateResponse.name(),
                    // MVP2 new fields — null-safe fallbacks
                    ai.matchedSkills() != null ? ai.matchedSkills() : List.of(),
                    ai.missingSkills() != null ? ai.missingSkills() : List.of(),
                    ai.consistencyBreakdown() != null ? ai.consistencyBreakdown() : List.of(),
                    ai.strengthSignals() != null ? ai.strengthSignals() : List.of(),
                    ai.aiVerdict(),
                    ai.aiConfidence(),
                    ai.aiConfidenceNote(),
                    ai.executionTier(),
                    ai.executionTierNote());

            persistAnalysisToDb(response, loginId);
            cache.put(candidateId, response);
            return response;

        } catch (Exception e) {
            throw new RuntimeException("AI analysis failed: " + e.getMessage(), e);
        }
    }

    // ─── MVP2: AI Candidate Summary ──────────────────────────────────────────

    public CandidateSummaryResponse getCandidateSummary(String candidateId, String loginId) {
        // Fix: list + get(0) avoids NPE when column value is null
        List<String> summaryRows = jdbc.query("""
                select ai_summary_json from analyses
                where candidate_id = ?
                order by analyzed_at desc limit 1
                """,
                (rs, r) -> rs.getString("ai_summary_json"),
                candidateId);
        String stored = summaryRows.isEmpty() ? null : summaryRows.get(0);

        if (stored != null && !stored.isBlank() && !stored.equals("null")) {
            try {
                return objectMapper.readValue(stored, CandidateSummaryResponse.class);
            } catch (Exception ignored) {
            }
        }

        String cvText = loadCvTextFromDb(candidateId);
        String jdText = getJdForCandidate(candidateId);
        String candidateName = getCandidateName(candidateId);

        String systemPrompt = """
                You are a senior recruitment consultant writing a concise candidate briefing.
                Return EXACTLY ONE JSON object:

                {
                  "candidateId": "<id>",
                  "professionalSummary": "<2-4 sentence professional summary>",
                  "strengths": ["...", "..."],
                  "concerns": ["...", "..."],
                  "interviewFocusAreas": ["...", "..."]
                }

                Rules:
                - strengths: 3-5 bullet points.
                - concerns: 2-4 bullet points.
                - interviewFocusAreas: 3-5 short phrases (e.g. "Kubernetes depth").
                - No markdown. No extra keys.
                """;

        String userPrompt = """
                CANDIDATE ID: %s
                CANDIDATE NAME: %s
                CV TEXT: %s
                JOB DESCRIPTION: %s
                """.formatted(candidateId, candidateName,
                safeTrim(cvText, 8000), safeTrim(jdText, 4000));

        String content = callOpenAI(systemPrompt, userPrompt, loginId);
        try {
            CandidateSummaryResponse result = objectMapper.readValue(
                    cleanJson(content), CandidateSummaryResponse.class);
            // Fix: re-serialize the parsed object — guarantees clean JSON for ::jsonb cast
            String cleanContent = objectMapper.writeValueAsString(result);
            jdbc.update("""
                    update analyses set ai_summary_json = ?::jsonb
                    where candidate_id = ? and id = (
                        select id from analyses where candidate_id = ? order by analyzed_at desc limit 1
                    )
                    """, cleanContent, candidateId, candidateId);
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse candidate summary: " + e.getMessage(), e);
        }
    }

    // ─── MVP2: Fraud Detection

    // ─── MVP2: Fraud Detection ────────────────────────────────────────────────

    public FraudSignalResponse getFraudSignals(String candidateId, String loginId) {
        // Fix: list + get(0) avoids NPE when column value is null
        List<String> fraudRows = jdbc.query("""
                select fraud_signals_json from analyses
                where candidate_id = ?
                order by analyzed_at desc limit 1
                """,
                (rs, r) -> rs.getString("fraud_signals_json"),
                candidateId);
        String stored = fraudRows.isEmpty() ? null : fraudRows.get(0);

        if (stored != null && !stored.isBlank() && !stored.equals("null")) {
            try {
                return objectMapper.readValue(stored, FraudSignalResponse.class);
            } catch (Exception ignored) {
            }
        }

        String cvText = loadCvTextFromDb(candidateId);
        String linkedinUrl = loadLinkedinUrlFromDb(candidateId);

        String systemPrompt = """
                You are a fraud detection specialist in recruitment.
                Analyse the CV vs LinkedIn URL for authenticity issues.
                Return EXACTLY ONE JSON object:

                {
                  "candidateId": "<id>",
                  "authenticityScore": 0-100,
                  "overallVerdict": "Low Risk|Proceed with Caution|High Risk",
                  "signals": [
                    {
                      "type": "AI_GENERATED|TIMELINE_INCONSISTENCY|SKILL_MISMATCH|CAREER_PATTERN",
                      "severity": "Low|Medium|High",
                      "title": "<short title>",
                      "description": "<detailed description>"
                    }
                  ]
                }

                Rules:
                - authenticityScore: 100 = fully authentic, 0 = highly suspicious.
                - signals: 3-5 items covering different categories.
                - Include a CAREER_PATTERN signal with severity Low if career is normal.
                - No markdown. No extra keys.
                """;

        String userPrompt = """
                CANDIDATE ID: %s
                CV TEXT: %s
                LINKEDIN URL / DATA: %s
                """.formatted(candidateId,
                safeTrim(cvText, 8000), safeTrim(linkedinUrl, 2000));

        String content = callOpenAI(systemPrompt, userPrompt, loginId);
        try {
            FraudSignalResponse result = objectMapper.readValue(
                    cleanJson(content), FraudSignalResponse.class);
            // Fix: re-serialize the parsed object — guarantees clean JSON for ::jsonb cast
            String cleanContent = objectMapper.writeValueAsString(result);
            jdbc.update("""
                    update analyses set fraud_signals_json = ?::jsonb
                    where candidate_id = ? and id = (
                        select id from analyses where candidate_id = ? order by analyzed_at desc limit 1
                    )
                    """, cleanContent, candidateId, candidateId);
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse fraud signals: " + e.getMessage(), e);
        }
    }

    // ─── MVP2: Placement Probability ─────────────────────────────────────────

    public PlacementProbabilityResponse getPlacementProbability(String candidateId, String loginId) {
        // Fix: list + get(0) avoids NPE when column value is null
        List<String> placementRows = jdbc.query("""
                select placement_prob_json from analyses
                where candidate_id = ?
                order by analyzed_at desc limit 1
                """,
                (rs, r) -> rs.getString("placement_prob_json"),
                candidateId);
        String stored = placementRows.isEmpty() ? null : placementRows.get(0);

        if (stored != null && !stored.isBlank() && !stored.equals("null")) {
            try {
                return objectMapper.readValue(stored, PlacementProbabilityResponse.class);
            } catch (Exception ignored) {
            }
        }

        String cvText = loadCvTextFromDb(candidateId);
        String jdText = getJdForCandidate(candidateId);

        String systemPrompt = """
                You are a data-driven recruitment analyst who predicts placement likelihood.
                Return EXACTLY ONE JSON object:

                {
                  "candidateId": "<id>",
                  "placementProbability": 0-100,
                  "confidenceLevel": "Low|Medium|High",
                  "basedOnSimilarPlacements": <integer estimate>,
                  "positiveSignals": ["...", "..."],
                  "riskFactors": ["...", "..."]
                }

                Rules:
                - placementProbability: realistic estimate 0-100.
                - confidenceLevel: Low if CV is thin, High if very detailed.
                - basedOnSimilarPlacements: estimate a plausible number (50-500).
                - positiveSignals: 3-5 items.
                - riskFactors: 2-4 items.
                - No markdown. No extra keys.
                """;

        String userPrompt = """
                CANDIDATE ID: %s
                CV TEXT: %s
                JOB DESCRIPTION: %s
                """.formatted(candidateId,
                safeTrim(cvText, 8000), safeTrim(jdText, 4000));

        String content = callOpenAI(systemPrompt, userPrompt, loginId);
        try {
            PlacementProbabilityResponse result = objectMapper.readValue(
                    cleanJson(content), PlacementProbabilityResponse.class);
            // Fix: re-serialize the parsed object — guarantees clean JSON for ::jsonb cast
            String cleanContent = objectMapper.writeValueAsString(result);
            jdbc.update("""
                    update analyses set placement_prob_json = ?::jsonb
                    where candidate_id = ? and id = (
                        select id from analyses where candidate_id = ? order by analyzed_at desc limit 1
                    )
                    """, cleanContent, candidateId, candidateId);
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse placement probability: " + e.getMessage(), e);
        }
    }

    // ─── Existing getters (unchanged) ─────────────────────────────────────────

    public Optional<CandidateAnalysisResponse> getCachedAnalysis(String candidateId) {
        return Optional.ofNullable(cache.get(candidateId));
    }

    public CandidateResponse getJobIdNameForCandidate(String candidateId) {
        return jdbc.query("""
                select id, job_id, name, email, linkedin_url, created_at, stage, cv_text
                from candidates where id = ?
                """,
                (rs, r) -> new CandidateResponse(
                        rs.getString("id"), rs.getString("job_id"),
                        rs.getString("name"), rs.getString("email"),
                        rs.getString("linkedin_url"),
                        rs.getTimestamp("created_at") != null
                                ? rs.getTimestamp("created_at").toInstant()
                                : null,
                        rs.getString("stage"),
                        rs.getString("cv_text")),
                candidateId).stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found: " + candidateId));
    }

    private static final RowMapper<AnalysisResponse> ANALYSIS_MAPPER = (rs, rowNum) -> {
        OffsetDateTime analyzedAt = rs.getObject("analyzed_at", OffsetDateTime.class);
        return new AnalysisResponse(
                rs.getLong("id"),
                rs.getString("candidate_id"),
                rs.getString("candidate_name"),
                rs.getString("job_id"),
                analyzedAt != null ? analyzedAt.toInstant() : null,
                (Integer) rs.getObject("consistency_score"),
                (Integer) rs.getObject("capability_score"),
                rs.getString("risk_level"),
                (Integer) rs.getObject("timeline_match_percent"));
    };

    public List<AnalysisResponse> getAnalysesFromDb(String loginId) {
        return jdbc.query("""
                select id, candidate_id, candidate_name, job_id, analyzed_at,
                       consistency_score, capability_score, risk_level, timeline_match_percent
                from analyses where login_id = ?
                order by analyzed_at desc
                """, ANALYSIS_MAPPER, loginId);
    }

    public List<AnalysisResponse> getAnalysisForCandidate(String candidateId) {
        return jdbc.query("""
                select id, candidate_id, candidate_name, job_id, analyzed_at,
                       consistency_score, capability_score, risk_level, timeline_match_percent
                from analyses where candidate_id = ?
                order by analyzed_at desc limit 1
                """, ANALYSIS_MAPPER, candidateId);
    }

    public CandidateAnalysisResponse getAIAnalysisForCandidate(String candidateId) {
        List<CandidateAnalysisResponse> results = jdbc.query("""
                select a.candidate_id, a.job_id, a.analyzed_at, a.analysis_json,
                       c.name as candidate_name
                from analyses a
                join candidates c on c.id = a.candidate_id
                where a.candidate_id = ?
                order by a.analyzed_at desc limit 1
                """,
                (rs, rowNum) -> {
                    try {
                        String json = rs.getString("analysis_json");
                        CandidateAnalysisResponse parsed = objectMapper.readValue(json,
                                CandidateAnalysisResponse.class);
                        return new CandidateAnalysisResponse(
                                rs.getString("candidate_id"),
                                rs.getString("job_id"),
                                rs.getTimestamp("analyzed_at").toInstant(),
                                parsed.scores(),
                                parsed.consistency(),
                                parsed.capabilityMatrix(),
                                parsed.suggestedQuestions(),
                                parsed.riskFlags(),
                                parsed.recommendation(),
                                rs.getString("candidate_name"),
                                // MVP2 new fields — null-safe for old rows
                                parsed.matchedSkills() != null ? parsed.matchedSkills() : List.of(),
                                parsed.missingSkills() != null ? parsed.missingSkills() : List.of(),
                                parsed.consistencyBreakdown() != null ? parsed.consistencyBreakdown() : List.of(),
                                parsed.strengthSignals() != null ? parsed.strengthSignals() : List.of(),
                                parsed.aiVerdict(),
                                parsed.aiConfidence(),
                                parsed.aiConfidenceNote(),
                                parsed.executionTier(),
                                parsed.executionTierNote());
                    } catch (Exception e) {
                        throw new RuntimeException(
                                "Failed to parse analysis_json: " + e.getMessage(), e);
                    }
                }, candidateId);

        // ── Change: return null instead of throwing when no analysis exists ──
        return results.isEmpty() ? null : results.get(0);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private String callOpenAI(String systemPrompt, String userPrompt, String loginId) {
        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(systemPrompt)
                .addUserMessage(userPrompt)
                .temperature(0.2)
                .build();
        var completion = openAI.chat().completions().create(params);
        tokenService.deductToken(loginId);
        return completion.choices().getFirst().message().content()
                .orElseThrow(() -> new IllegalStateException("Model returned empty content"));
    }

    private static String cleanJson(String s) {
        String t = s.strip();
        if (t.startsWith("```")) {
            t = t.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
        }
        return t;
    }

    private static String safeTrim(String s, int max) {
        if (s == null)
            return "";
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String getJdForCandidate(String candidateId) {
        return jdbc.query("""
                select j.jd_text from jobs j
                join candidates c on c.job_id = j.id
                where c.id = ?
                """,
                (rs, r) -> rs.getString("jd_text"), candidateId)
                .stream().findFirst().orElse("");
    }

    private String getCandidateName(String candidateId) {
        return jdbc.query("select name from candidates where id = ?",
                (rs, r) -> rs.getString("name"), candidateId)
                .stream().findFirst().orElse("Unknown");
    }

    private void persistAnalysisToDb(CandidateAnalysisResponse response, String loginId) {
        try {
            String analysisJson = objectMapper.writeValueAsString(response);
            Integer consistencyScore = response.scores() != null ? response.scores().consistencyScore() : null;
            Integer capabilityScore = response.scores() != null ? response.scores().capabilityScore() : null;
            String riskLevel = response.scores() != null ? response.scores().riskLevel() : null;
            Integer timelineMatch = response.consistency() != null
                    ? response.consistency().timelineMatchPercent()
                    : null;

            OffsetDateTime analyzedAt = response.analyzedAt() != null
                    ? OffsetDateTime.ofInstant(response.analyzedAt(), ZoneOffset.UTC)
                    : OffsetDateTime.now(ZoneOffset.UTC);

            jdbc.update("""
                    insert into analyses (
                      candidate_id, job_id, login_id, analyzed_at,
                      consistency_score, capability_score, risk_level,
                      timeline_match_percent, candidate_name, analysis_json
                    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                    """,
                    response.candidateId(), response.jobId(), loginId, analyzedAt,
                    consistencyScore, capabilityScore, riskLevel,
                    timelineMatch, response.candidate_name(), analysisJson);

        } catch (Exception e) {
            throw new RuntimeException("Failed to persist analysis: " + e.getMessage(), e);
        }
    }

    // ─── Inner record — updated to include all MVP2 fields ───────────────────
    // Jackson deserialises the OpenAI JSON response into this,
    // then it is mapped into CandidateAnalysisResponse.

    public record AiAnalysisResult(
            CandidateAnalysisResponse.Scores scores,
            CandidateAnalysisResponse.Consistency consistency,
            CandidateAnalysisResponse.CapabilityMatrix capabilityMatrix,
            List<CandidateAnalysisResponse.SuggestedQuestion> suggestedQuestions,
            List<String> riskFlags,
            String recommendation,
            // MVP2 additions
            List<String> matchedSkills,
            List<String> missingSkills,
            List<CandidateAnalysisResponse.ConsistencyBreakdownItem> consistencyBreakdown,
            List<CandidateAnalysisResponse.StrengthSignal> strengthSignals,
            CandidateAnalysisResponse.AiVerdict aiVerdict,
            String aiConfidence,
            String aiConfidenceNote,
            Integer executionTier,
            String executionTierNote) {
    }
}