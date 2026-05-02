package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.AiAnalysisResult;
import com.nolyvra.app.model.CandidateAnalysisResponse;
import com.nolyvra.app.model.CandidateResponse;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@ConditionalOnExpression("'${nolyvra.mock-ai:false}' != 'true' && !'${openai.api-key:}'.startsWith('sk-local-placeholder')")
public class OpenAICandidateAnalysisRunner implements CandidateAnalysisRunner {

    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final TokenService tokenService;
    private final String model;

    public OpenAICandidateAnalysisRunner(
            OpenAIClient openAI,
            ObjectMapper objectMapper,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.openAI = openAI;
        this.objectMapper = objectMapper;
        this.tokenService = tokenService;
        this.model = model;
    }

    @Override
    public CandidateAnalysisResponse analyze(
            String candidateId,
            CandidateResponse candidate,
            String loginId,
            String jdText,
            String cvText,
            String linkedinUrl) {
        if (!tokenService.hasTokens(loginId)) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Insufficient tokens");
        }

        try {
            String passDate = "Today's date is " + LocalDate.now().format(DateTimeFormatter.ofPattern("d MMMM yyyy")) + ". ";
            String systemPrompt = passDate + """
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

            return new CandidateAnalysisResponse(
                    candidateId,
                    candidate.jobId(),
                    Instant.now(),
                    ai.scores(),
                    ai.consistency(),
                    ai.capabilityMatrix(),
                    ai.suggestedQuestions(),
                    ai.riskFlags(),
                    ai.recommendation(),
                    candidate.name(),
                    ai.matchedSkills() != null ? ai.matchedSkills() : List.of(),
                    ai.missingSkills() != null ? ai.missingSkills() : List.of(),
                    ai.consistencyBreakdown() != null ? ai.consistencyBreakdown() : List.of(),
                    ai.strengthSignals() != null ? ai.strengthSignals() : List.of(),
                    ai.aiVerdict(),
                    ai.aiConfidence(),
                    ai.aiConfidenceNote(),
                    ai.executionTier(),
                    ai.executionTierNote());
        } catch (Exception e) {
            throw new RuntimeException("AI analysis failed: " + e.getMessage(), e);
        }
    }

    private static String cleanJson(String s) {
        String t = s.strip();
        if (t.startsWith("```")) {
            t = t.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
        }
        return t;
    }

    private static String safeTrim(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }
}
