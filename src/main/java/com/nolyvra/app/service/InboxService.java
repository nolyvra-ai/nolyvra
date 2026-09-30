package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.EmailHistoryResponse;
import com.nolyvra.app.model.EmailSendRequest;
import com.nolyvra.app.model.EmailTemplateResponse;
import com.nolyvra.app.model.InboxPageResponse;
import com.nolyvra.app.model.InboxReplyRequest;
import com.nolyvra.app.model.InboxThreadMessage;
import com.nolyvra.app.model.InboxThreadResponse;
import com.nolyvra.app.model.OAuthToken;
import com.nolyvra.app.model.TemplateSuggestion;
import com.nolyvra.app.model.TemplateSuggestionResponse;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Thin live proxy over the connected mailbox — nothing fetched here is ever
// persisted. Only outbound sends (reply()) touch the database, via the exact
// same EmailService.sendEmail() path (and email_history logging) that the
// compose form already uses.
@Service
public class InboxService {

    private final MicrosoftOAuthService microsoftOAuthService;
    private final GoogleOAuthService googleOAuthService;
    private final EmailService emailService;
    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final String model;

    public InboxService(
            MicrosoftOAuthService microsoftOAuthService,
            GoogleOAuthService googleOAuthService,
            EmailService emailService,
            OpenAIClient openAIClient,
            ObjectMapper objectMapper,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.microsoftOAuthService = microsoftOAuthService;
        this.googleOAuthService = googleOAuthService;
        this.emailService = emailService;
        this.openAI = openAIClient;
        this.objectMapper = objectMapper;
        this.model = model;
    }

    // ─── GET /api/inbox/messages ───────────────────────────────────────────────

    public InboxPageResponse listMessages(String loginId, String provider, boolean unreadOnly,
                                           String pageToken, int pageSize) {
        String p = normalizeProvider(provider);
        try {
            return "microsoft".equals(p)
                    ? microsoftOAuthService.listInboxMessages(loginId, unreadOnly, pageToken, pageSize)
                    : googleOAuthService.listInboxMessages(loginId, unreadOnly, pageToken, pageSize);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to fetch inbox: " + e.getMessage());
        }
    }

    // ─── GET /api/inbox/threads/{threadId} ─────────────────────────────────────

    public InboxThreadResponse getThread(String loginId, String provider, String threadId) {
        String p = normalizeProvider(provider);
        try {
            String ownerEmail = ownerEmail(loginId, p);
            List<InboxThreadMessage> raw = "microsoft".equals(p)
                    ? microsoftOAuthService.getConversationMessages(loginId, threadId)
                    : googleOAuthService.getThreadMessages(loginId, threadId);

            List<InboxThreadMessage> resolved = raw.stream()
                    .map(m -> new InboxThreadMessage(
                            m.id(), m.provider(), m.fromName(), m.fromAddress(), m.toAddresses(),
                            m.subject(), m.bodyHtml(), m.bodyText(), m.occurredAt(),
                            ownerEmail != null && ownerEmail.equalsIgnoreCase(m.fromAddress()),
                            m.unread()))
                    .collect(Collectors.toList());

            String subject = resolved.isEmpty() ? "" : resolved.get(resolved.size() - 1).subject();
            return new InboxThreadResponse(threadId, p, subject, resolved);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to fetch thread: " + e.getMessage());
        }
    }

    // ─── PATCH /api/inbox/messages/{id}/read ───────────────────────────────────

    public void markRead(String loginId, String provider, String messageId, boolean read) {
        String p = normalizeProvider(provider);
        try {
            if ("microsoft".equals(p)) microsoftOAuthService.markMessageRead(loginId, messageId, read);
            else googleOAuthService.markMessageRead(loginId, messageId, read);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to update message: " + e.getMessage());
        }
    }

    // ─── POST /api/inbox/messages/{id}/archive ─────────────────────────────────

    public void archive(String loginId, String provider, String messageId) {
        String p = normalizeProvider(provider);
        try {
            if ("microsoft".equals(p)) microsoftOAuthService.archiveMessage(loginId, messageId);
            else googleOAuthService.archiveMessage(loginId, messageId);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to archive message: " + e.getMessage());
        }
    }

    // ─── POST /api/inbox/reply — reuses the exact same send path (and
    // email_history logging) as the compose form, so a reply shows up in Sent
    // identically to a composed email. ──────────────────────────────────────────

    public EmailHistoryResponse reply(InboxReplyRequest req, String loginId) {
        normalizeProvider(req.provider()); // validates early, matches provider naming convention below
        EmailSendRequest sendReq = new EmailSendRequest(
                req.toAddress(), req.subject(), req.body(), req.candidateId(), null, null);
        return emailService.sendEmail(sendReq, loginId);
    }

    // ─── GET /api/inbox/templates/suggest — ranks the recruiter's own templates
    // against the inbound message. No token deduction — a small assist, not a
    // billed AI action. ─────────────────────────────────────────────────────────

    public TemplateSuggestionResponse suggestTemplates(String loginId, String messageBody) {
        List<EmailTemplateResponse> templates = emailService.getTemplates(loginId);
        if (templates.isEmpty() || messageBody == null || messageBody.isBlank()) {
            return new TemplateSuggestionResponse(List.of());
        }

        String templateList = templates.stream()
                .map(t -> "id=" + t.id() + " | name=" + t.name() + " | subject=" + t.subject())
                .collect(Collectors.joining("\n"));

        String systemPrompt = """
                You are helping a recruiter pick the best-fitting reply template for an inbound email.
                Given the inbound email and a list of templates (id | name | subject), return EXACTLY ONE
                JSON object — no markdown:
                {"suggestions": [{"templateId": 1, "confidence": 0-100, "reason": "short reason"}]}
                Only include templates that are plausibly relevant, ranked best first, max 3.
                """;

        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(systemPrompt)
                .addUserMessage("INBOUND EMAIL:\n" + messageBody + "\n\nTEMPLATES:\n" + templateList)
                .temperature(0.2)
                .build();

        try {
            String content = openAI.chat().completions().create(params)
                    .choices().getFirst().message().content().orElse("{}");
            String clean = content.strip()
                    .replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
            JsonNode root = objectMapper.readTree(clean);

            Map<Long, EmailTemplateResponse> byId = templates.stream()
                    .collect(Collectors.toMap(EmailTemplateResponse::id, t -> t));

            List<TemplateSuggestion> suggestions = new ArrayList<>();
            for (JsonNode s : root.path("suggestions")) {
                EmailTemplateResponse t = byId.get(s.path("templateId").asLong(-1));
                if (t == null) continue;
                suggestions.add(new TemplateSuggestion(
                        t.id(), t.name(), t.subject(),
                        Math.max(0, Math.min(100, s.path("confidence").asInt(50))),
                        s.path("reason").asText("")));
            }
            return new TemplateSuggestionResponse(suggestions);
        } catch (Exception e) {
            System.err.println("[Inbox] template suggestion failed: " + e.getMessage());
            return new TemplateSuggestionResponse(List.of());
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private String ownerEmail(String loginId, String normalizedProvider) {
        OAuthToken token = "microsoft".equals(normalizedProvider)
                ? microsoftOAuthService.getToken(loginId)
                : googleOAuthService.getToken(loginId);
        return token != null ? token.email() : null;
    }

    private static String normalizeProvider(String provider) {
        if ("microsoft".equalsIgnoreCase(provider) || "google".equalsIgnoreCase(provider)) {
            return provider.toLowerCase();
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown provider: " + provider);
    }
}
