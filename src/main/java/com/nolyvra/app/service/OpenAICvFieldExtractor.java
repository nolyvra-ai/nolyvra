package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@ConditionalOnExpression("'${nolyvra.mock-ai:false}' != 'true' && !'${openai.api-key:}'.startsWith('sk-local-placeholder')")
public class OpenAICvFieldExtractor implements CvFieldExtractor {

    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final TokenService tokenService;
    private final String model;

    public OpenAICvFieldExtractor(
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
    public Map<String, Object> extractFields(String rawText, String originalFilename, String loginId) {
        try {
            if (!tokenService.deductToken(loginId)) {
                throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Insufficient tokens");
            }

            String snippet = rawText.length() > 3000 ? rawText.substring(0, 3000) : rawText;
            String prompt = """
                    Extract the following fields from this CV text.
                    Return EXACTLY ONE JSON object — no markdown, no extra keys:
                    {
                      "name": "Full name of the candidate or null",
                      "email": "Email address or null",
                      "phone": "Phone number or null",
                      "linkedinUrl": "LinkedIn profile URL or null",
                      "currentTitle": "Candidate's most recent/current job title or null",
                      "location": "City or suburb the candidate is based in, or null",
                      "state": "State/region abbreviation (e.g. VIC, NSW) or null",
                      "yearsExperience": "Total years of professional experience as a number, or null",
                      "seniorityLevel": "One of exactly: Junior, Mid, Mid-Senior, Senior, Lead/Principal — or null if unclear",
                      "expectedSalaryMin": "Minimum expected/current salary as a number if stated in the CV, or null",
                      "skills": ["up to 15 core technical/professional skills, ordered by relevance"]
                    }

                    CV TEXT:
                    %s
                    """.formatted(snippet);

            var params = ChatCompletionCreateParams.builder()
                    .model(model)
                    .addUserMessage(prompt)
                    .temperature(0.0)
                    .build();

            String content = openAI.chat().completions().create(params)
                    .choices().getFirst().message().content().orElse("{}");

            var root = objectMapper.readTree(cleanJson(content));
            List<String> skills = new ArrayList<>();
            if (root.path("skills").isArray()) {
                root.path("skills").forEach(s -> {
                    if (!s.asText("").isBlank()) skills.add(s.asText());
                });
            }
            Map<String, Object> result = new java.util.HashMap<>();
            result.put("name", root.path("name").isNull() ? "" : root.path("name").asText(""));
            result.put("email", root.path("email").isNull() ? "" : root.path("email").asText(""));
            result.put("phone", root.path("phone").isNull() ? "" : root.path("phone").asText(""));
            result.put("linkedinUrl", root.path("linkedinUrl").isNull() ? "" : root.path("linkedinUrl").asText(""));
            result.put("currentTitle", root.path("currentTitle").isNull() ? "" : root.path("currentTitle").asText(""));
            result.put("location", root.path("location").isNull() ? "" : root.path("location").asText(""));
            result.put("state", root.path("state").isNull() ? "" : root.path("state").asText(""));
            result.put("yearsExperience", root.path("yearsExperience").isNull() ? "" : root.path("yearsExperience").asText(""));
            result.put("seniorityLevel", root.path("seniorityLevel").isNull() ? "" : root.path("seniorityLevel").asText(""));
            result.put("expectedSalaryMin", root.path("expectedSalaryMin").isNull() ? "" : root.path("expectedSalaryMin").asText(""));
            result.put("skills", skills);
            return result;
        } catch (Exception e) {
            System.err.println("[CvExtract] Field extraction failed: " + e.getMessage());
            Map<String, Object> fallback = new java.util.HashMap<>();
            for (String key : new String[]{"name", "email", "phone", "linkedinUrl", "currentTitle",
                    "location", "state", "yearsExperience", "seniorityLevel", "expectedSalaryMin"}) {
                fallback.put(key, "");
            }
            fallback.put("skills", List.of());
            return fallback;
        }
    }

    private static String cleanJson(String s) {
        String t = s.strip();
        if (t.startsWith("```")) {
            t = t.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
        }
        return t;
    }
}
