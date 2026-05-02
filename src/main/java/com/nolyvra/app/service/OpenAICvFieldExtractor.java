package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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
            if (!tokenService.hasTokens(loginId)) {
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
                      "linkedinUrl": "LinkedIn profile URL or null"
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
            tokenService.deductToken(loginId);

            var root = objectMapper.readTree(cleanJson(content));
            return Map.of(
                    "name", root.path("name").isNull() ? "" : root.path("name").asText(""),
                    "email", root.path("email").isNull() ? "" : root.path("email").asText(""),
                    "phone", root.path("phone").isNull() ? "" : root.path("phone").asText(""),
                    "linkedinUrl", root.path("linkedinUrl").isNull() ? "" : root.path("linkedinUrl").asText(""));
        } catch (Exception e) {
            System.err.println("[CvExtract] Field extraction failed: " + e.getMessage());
            return Map.of("name", "", "email", "", "phone", "", "linkedinUrl", "");
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
