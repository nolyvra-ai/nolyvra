package com.nolyvra.app.service;

import com.nolyvra.app.model.MessageGenerateRequest;
import com.nolyvra.app.model.MessageGenerateResponse;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class MessageService {

    private final OpenAIClient openAI;
    private final JdbcTemplate jdbc;
    private final WorkflowService workflowService;
    private final String model;
    private final TokenService tokenService;

    public MessageService(
            OpenAIClient openAIClient,
            JdbcTemplate jdbc,
            WorkflowService workflowService,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.openAI = openAIClient;
        this.jdbc   = jdbc;
        this.workflowService = workflowService;
        this.tokenService    = tokenService;
        this.model  = model;
    }

    // ─── POST /api/messages/generate ─────────────────────────────────────────

    public MessageGenerateResponse generateMessage(MessageGenerateRequest req, String loginId) {

        // Load candidate info
        var rows = jdbc.query("""
                select c.name, c.email, c.stage, j.title as job_title, j.company
                from candidates c
                join jobs j on j.id = c.job_id
                where c.id = ?
                """,
                (rs, r) -> new String[]{
                        rs.getString("name"),
                        rs.getString("email"),
                        rs.getString("stage"),
                        rs.getString("job_title"),
                        rs.getString("company")
                }, req.candidateId());

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Candidate not found: " + req.candidateId());
        }

        String[] info = rows.get(0);
        String name     = info[0];
        String stage    = info[2];
        String jobTitle = info[3];
        String company  = info[4];

        // Recruiter name from login
        String recruiterName = jdbc.query(
                "select name from login where id = ?",
                (rs, r) -> rs.getString("name"), loginId)
                .stream().findFirst().orElse("The Recruitment Team");

        String messageTypeLabel = switch (req.messageType()) {
            case "INTERVIEW_INVITE" -> "a professional interview invitation";
            case "FOLLOW_UP"        -> "a polite follow-up after the interview";
            case "REJECTION"        -> "a respectful, empathetic rejection";
            case "OFFER"            -> "a formal job offer notification";
            default                 -> "a professional recruitment email";
        };

        String customInstruction = (req.customPrompt() != null && !req.customPrompt().isBlank())
                ? "\nAdditional instructions: " + req.customPrompt()
                : "";

        String systemPrompt = """
                You are a professional recruitment consultant drafting emails.
                Return EXACTLY ONE JSON object — no markdown, no extra keys:

                {
                  "subject": "<email subject line>",
                  "body": "<full email body — professional, warm, concise>",
                  "messageType": "<the messageType value passed in>"
                }

                Rules:
                - body must include a proper greeting using the candidate's name.
                - body must include the recruiter's name and role as sign-off.
                - body must be properly formatted with line breaks (use \\n).
                - Keep body under 250 words.
                """;

        String userPrompt = """
                Write %s for:
                - Candidate name: %s
                - Job role: %s at %s
                - Current pipeline stage: %s
                - Recruiter name: %s
                - Message type value: %s
                %s
                """.formatted(
                messageTypeLabel, name, jobTitle, company,
                stage, recruiterName, req.messageType(), customInstruction);

        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(systemPrompt)
                .addUserMessage(userPrompt)
                .temperature(0.4)
                .build();

        var completion = openAI.chat().completions().create(params);
        tokenService.deductToken(loginId);
        String content = completion.choices().getFirst().message().content()
                .orElseThrow(() -> new IllegalStateException("Model returned empty content"));

        try {
            String clean = content.strip();
            if (clean.startsWith("```")) {
                clean = clean.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
            }
            // Use Jackson to parse
            com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
            MessageGenerateResponse result = om.readValue(clean, MessageGenerateResponse.class);

            // Record in timeline
            workflowService.recordEvent(req.candidateId(), loginId, "MESSAGE_GENERATED",
                    req.messageType() + " message generated", null);

            return result;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse generated message: " + e.getMessage(), e);
        }
    }
}
