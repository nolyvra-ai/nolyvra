package com.depthhire.app.service;

import com.depthhire.app.model.AnalysisRequest;
import com.depthhire.app.model.AnalysisResponse;
import com.depthhire.app.model.CandidateAnalysisResponse;
import com.depthhire.app.model.CandidateResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.jdbc.core.JdbcTemplate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
public class AnalysisService {

        private final OpenAIClient openAI;
        private final ObjectMapper objectMapper;
        private final String model;

        private final Map<String, CandidateAnalysisResponse> cache = new ConcurrentHashMap<>();
        private final JdbcTemplate jdbc;

        /*
         * public AnalysisService(
         * ObjectMapper objectMapper,
         * 
         * @Value("${openai.api-key}") String apiKey,
         * 
         * @Value("${openai.model}") String model
         * ) {
         * this.objectMapper = objectMapper;
         * this.model = model;
         * 
         * if (apiKey == null || apiKey.isBlank()) {
         * throw new
         * IllegalStateException("OpenAI API key is missing in application.yml");
         * }
         * 
         * this.openAI = OpenAIOkHttpClient.builder()
         * .apiKey(apiKey)
         * .build();
         * }
         */

        public AnalysisService(
                        ObjectMapper objectMapper,
                        OpenAIClient openAIClient,
                        JdbcTemplate jdbcTemplate,
                        @Value("${openai.model:gpt-4o-mini}") String model) {
                this.objectMapper = objectMapper;
                this.openAI = openAIClient;
                this.jdbc = jdbcTemplate;
                this.model = model;
        }

        private String loadJobDescriptionFromDb(String jobId) {
                return jdbc.query("""
                                select jd_text
                                from jobs
                                where id = ?
                                """,
                                (rs, rowNum) -> rs.getString("jd_text"),
                                jobId).stream().findFirst()
                                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
        }

        private String loadCvTextFromDb(String candidateId) {
                return jdbc.query("""
                                select cv_text
                                from candidates
                                where id = ?
                                """,
                                (rs, rowNum) -> rs.getString("cv_text"),
                                candidateId).stream().findFirst()
                                .orElseThrow(() -> new IllegalArgumentException("Candidate not found: " + candidateId));
        }

        private String loadLinkedinUrlFromDb(String candidateId) {
                return jdbc.query("""
                                select linkedin_url
                                from candidates
                                where id = ?
                                """,
                                (rs, rowNum) -> rs.getString("linkedin_url"),
                                candidateId).stream().findFirst()
                                .orElseThrow(() -> new IllegalArgumentException("Candidate not found: " + candidateId));
        }

        public CandidateAnalysisResponse analyze(String candidateId,
                        String jobId, String loginId) {

                String jdText = loadJobDescriptionFromDb(jobId);
                String cvText = loadCvTextFromDb(candidateId);
                String linkedinUrl = loadLinkedinUrlFromDb(candidateId);
                try {

                        String systemPrompt = """
                                        You are an expert technical recruiter + senior software architect.

                                        You must return EXACTLY ONE JSON object.
                                        No markdown. No extra keys. No commentary.

                                        Return JSON ONLY in this exact schema (keys must match exactly):

                                        {
                                          "scores": { "consistencyScore": 0-100 int, "capabilityScore": 0-100 int, "riskLevel": "Low|Medium|High" },
                                          "consistency": {
                                            "timelineMatchPercent": 0-100 int,
                                            "flags": [ { "severity": "Low|Medium|High", "type": "DATE_MISMATCH|TITLE_MISMATCH|MISSING_ROLE|OTHER", "message": "..." } ]
                                          },
                                          "capabilityMatrix": {
                                            "rows": [ { "capability": "...", "weightPercent": int, "scorePercent": 0-100 int, "gapLevel": "Low|Medium|High" } ],
                                            "weights": { "System Design": int, "Cloud Architecture": int, "Leadership": int, "Domain Knowledge": int }
                                          },
                                          "suggestedQuestions": [
                                            { "order": 1, "type": "system_design|architecture|behavioral|debugging|leadership|domain", "intent": "...", "question": "..." }
                                          ],
                                          "riskFlags": ["..."],
                                          "recommendation": "..."
                                        }

                                        Hard requirements:
                                        - Use ONLY these top-level keys: scores, consistency, capabilityMatrix, suggestedQuestions, riskFlags, recommendation.
                                        - weights must sum to 100 exactly and must include: System Design, Cloud Architecture, Leadership, Domain Knowledge.
                                        - capabilityMatrix.rows must include exactly those 4 capabilities with matching weightPercent values.
                                        - suggestedQuestions must be exactly 6 items with order 1..6.
                                        - riskFlags must be 3-6 items.
                                        - Do not output job_description/cv/linkedin objects.
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

                        /*
                         * var params = ChatCompletionCreateParams.builder()
                         * .model(model)
                         * .addSystemMessage(systemPrompt)
                         * .addUserMessage(userPrompt)
                         * .temperature(0.2)
                         * .build();
                         */
                        var params = ChatCompletionCreateParams.builder()
                                        .model(model)
                                        .addSystemMessage(systemPrompt)
                                        .addUserMessage(userPrompt)
                                        .temperature(0.2)
                                        .build();

                        var completion = openAI.chat().completions().create(params);

                        var content = completion.choices()
                                        .getFirst()
                                        .message()
                                        .content()
                                        .orElseThrow(() -> new IllegalStateException("Model returned empty content"));

                        AiAnalysisResult ai = objectMapper.readValue(content, AiAnalysisResult.class);

                        CandidateAnalysisResponse response = new CandidateAnalysisResponse(
                                        candidateId,
                                        jobId,
                                        Instant.now(),
                                        ai.scores(),
                                        ai.consistency(),
                                        ai.capabilityMatrix(),
                                        ai.suggestedQuestions(),
                                        ai.riskFlags(),
                                        ai.recommendation());
                        persistAnalysisToDb(response,loginId);
                        cache.put(candidateId, response);
                        return response;

                } catch (Exception e) {
                        throw new RuntimeException("AI analysis failed: " + e.getMessage(), e);
                }
        }

        public Optional<CandidateAnalysisResponse> getCachedAnalysis(String candidateId) {
                return Optional.ofNullable(cache.get(candidateId));
        }

        private static String safeTrim(String s, int max) {
                if (s == null)
                        return "";
                return s.length() <= max ? s : s.substring(0, max);
        }

        public record AiAnalysisResult(
                        CandidateAnalysisResponse.Scores scores,
                        CandidateAnalysisResponse.Consistency consistency,
                        CandidateAnalysisResponse.CapabilityMatrix capabilityMatrix,
                        java.util.List<CandidateAnalysisResponse.SuggestedQuestion> suggestedQuestions,
                        java.util.List<String> riskFlags,
                        String recommendation) {
        }

        private void persistAnalysisToDb(CandidateAnalysisResponse response, String loginId) {
                try {
                        // store full response as JSONB
                        String analysisJson = objectMapper.writeValueAsString(response);

                        Integer consistencyScore = response.scores() != null ? response.scores().consistencyScore()
                                        : null;
                        Integer capabilityScore = response.scores() != null ? response.scores().capabilityScore()
                                        : null;
                        String riskLevel = response.scores() != null ? response.scores().riskLevel() : null;

                        Integer timelineMatchPercent = response.consistency() != null
                                        ? response.consistency().timelineMatchPercent()
                                        : null;

                        OffsetDateTime analyzedAt = response.analyzedAt() != null
                                        ? OffsetDateTime.ofInstant(response.analyzedAt(), ZoneOffset.UTC)
                                        : OffsetDateTime.now(ZoneOffset.UTC);

                        jdbc.update("""
                                        insert into analyses (
                                          candidate_id,
                                          job_id,
                                          login_id,
                                          analyzed_at,
                                          consistency_score,
                                          capability_score,
                                          risk_level,
                                          timeline_match_percent,
                                          analysis_json
                                        )
                                        values (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                                        """,
                                        response.candidateId(),
                                        response.jobId(),
                                        loginId,
                                        analyzedAt,
                                        consistencyScore,
                                        capabilityScore,
                                        riskLevel,
                                        timelineMatchPercent,
                                        analysisJson);

                } catch (Exception e) {
                        throw new RuntimeException("Failed to persist analysis to DB: " + e.getMessage(), e);
                }
        }

        public String getJobIdForCandidate(String candidateId) {
                return jdbc.query("""
                                select job_id
                                from candidates
                                where id = ?
                                """,
                                (rs, rowNum) -> rs.getString("job_id"),
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
                                select
                                  id,
                                  candidate_id,
                                  candidate_name,
                                  job_id,
                                  analyzed_at,
                                  consistency_score,
                                  capability_score,
                                  risk_level,
                                  timeline_match_percent
                                from analyses
                                where login_id = ?
                                order by analyzed_at desc
                                limit 5
                                """,
                                ANALYSIS_MAPPER,loginId );
        }
}