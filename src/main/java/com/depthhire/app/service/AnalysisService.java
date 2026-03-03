package com.depthhire.app.service;

import com.depthhire.app.model.AnalysisRequest;
import com.depthhire.app.model.CandidateAnalysisResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AnalysisService {

        private final OpenAIClient openAI;
        private final ObjectMapper objectMapper;
        private final String model;

        private final Map<String, CandidateAnalysisResponse> cache = new ConcurrentHashMap<>();

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
                        @Value("${openai.model:gpt-4o-mini}") String model) {
                this.objectMapper = objectMapper;
                this.openAI = openAIClient;
                this.model = model;
        }

        public CandidateAnalysisResponse analyze(String candidateId,
                        String jobId,
                        AnalysisRequest request) {

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
                                        safeTrim(request.getJobDescription(), 10000),
                                        safeTrim(request.getCvText(), 10000),
                                        safeTrim(request.getLinkedinProfile(), 10000));

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
}