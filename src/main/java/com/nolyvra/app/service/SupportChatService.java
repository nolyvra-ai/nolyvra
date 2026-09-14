package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.SupportChatRequest;
import com.nolyvra.app.model.SupportChatResponse;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SupportChatService {

    private static final String FALLBACK_ESCALATED_MESSAGE =
            "I couldn't find a confident answer to that in our Help Center. I've flagged your question for our team — you'll hear back by email shortly.";

    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final EmailService emailService;
    private final JdbcTemplate jdbc;
    private final String model;
    private final String escalationEmail;

    public SupportChatService(
            OpenAIClient openAI,
            ObjectMapper objectMapper,
            EmailService emailService,
            JdbcTemplate jdbc,
            @Value("${openai.model:gpt-4o-mini}") String model,
            @Value("${support.escalation-email:sayan.b@nolyvra.com}") String escalationEmail) {
        this.openAI = openAI;
        this.objectMapper = objectMapper;
        this.emailService = emailService;
        this.jdbc = jdbc;
        this.model = model;
        this.escalationEmail = escalationEmail;
    }

    public SupportChatResponse respond(String loginId, SupportChatRequest request) {
        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(buildSystemPrompt(request.articles(), request.history()))
                .addUserMessage(request.message())
                .temperature(0.2)
                .build();

        var completion = openAI.chat().completions().create(params);
        String content = completion.choices().getFirst().message().content()
                .orElse("{\"answer\":\"\",\"canAnswer\":false}");

        return parseResponse(loginId, request.message(), content);
    }

    private String buildSystemPrompt(
            List<SupportChatRequest.ArticleContext> articles,
            List<SupportChatRequest.ChatMessage> history) {
        StringBuilder articleContext = new StringBuilder();
        if (articles != null) {
            for (var a : articles) {
                articleContext.append("Title: ").append(a.title())
                        .append("\nSummary: ").append(a.summary())
                        .append("\nContent: ").append(a.body())
                        .append("\n---\n");
            }
        }

        String systemPrompt = """
                You are the Nolyvra Help Center assistant. You answer recruiter questions about how to use the
                Nolyvra app using ONLY the Help Center articles provided below. Do not use outside knowledge and
                do not guess.

                HELP CENTER ARTICLES:
                %s

                You MUST return EXACTLY ONE JSON object with this shape:
                {
                  "answer": "<your answer, or a short note that you can't help with this>",
                  "canAnswer": true|false
                }

                Rules:
                - Set "canAnswer" to true only if the articles above directly answer the question.
                - If the articles don't cover the question, set "canAnswer" to false and leave "answer" empty.
                - Keep answers concise and specific, referencing steps from the articles where relevant.
                - No markdown. No extra keys. Respond with ONLY the JSON object, nothing else.
                """
                .formatted(articleContext.length() > 0 ? articleContext : "(no matching articles found)");

        if (history == null || history.isEmpty()) {
            return systemPrompt;
        }

        StringBuilder conversation = new StringBuilder();
        for (var h : history) {
            conversation.append(h.role().toUpperCase()).append(": ").append(h.content()).append("\n");
        }
        return systemPrompt + "\n\nCONVERSATION SO FAR:\n" + conversation;
    }

    private SupportChatResponse parseResponse(String loginId, String question, String content) {
        String clean = cleanJson(content);
        boolean canAnswer = false;
        String answer = "";

        try {
            var root = objectMapper.readTree(clean);
            answer = root.path("answer").asText("");
            canAnswer = root.path("canAnswer").asBoolean(false);
        } catch (Exception e) {
            // Fall through — treat an unparsable response as "can't answer" and escalate.
        }

        if (canAnswer && !answer.isBlank()) {
            return new SupportChatResponse(answer, false);
        }

        escalate(loginId, question);
        return new SupportChatResponse(FALLBACK_ESCALATED_MESSAGE, true);
    }

    private void escalate(String loginId, String question) {
        String reporterEmail = lookupEmail(loginId);
        String subject = "Support chat escalation from " + loginId;
        String body = "Login ID: " + loginId
                + "\nReporter email: " + (reporterEmail != null ? reporterEmail : "unknown")
                + "\n\nQuestion:\n" + question;
        emailService.sendSystemEmail(escalationEmail, subject, body);
    }

    private String lookupEmail(String loginId) {
        try {
            return jdbc.queryForObject("select email from login where id = ?", String.class, loginId);
        } catch (EmptyResultDataAccessException e) {
            return null;
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
