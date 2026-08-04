package com.nolyvra.app.service;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class RegisterInterestNotificationService {

    private static final int MAX_RESEND_ATTEMPTS = 4;
    private static final long INITIAL_BACKOFF_MS = 700L;
    private static final long BETWEEN_EMAIL_DELAY_MS = 550L;

    private final AdminSettingsService adminSettingsService;
    private final SystemEmailTemplateService systemEmailTemplateService;
    private final EmailTemplateImageService emailTemplateImageService;
    private final JdbcTemplate jdbc;
    private final String apiKey;
    private final String fromAddress;

    public RegisterInterestNotificationService(
            AdminSettingsService adminSettingsService,
            SystemEmailTemplateService systemEmailTemplateService,
            EmailTemplateImageService emailTemplateImageService,
            JdbcTemplate jdbc,
            @Value("${resend.api-key:}") String apiKey,
            @Value("${resend.from:Nolyvra <onboarding@resend.dev>}") String fromAddress) {
        this.adminSettingsService = adminSettingsService;
        this.systemEmailTemplateService = systemEmailTemplateService;
        this.emailTemplateImageService = emailTemplateImageService;
        this.jdbc = jdbc;
        this.apiKey = apiKey;
        this.fromAddress = fromAddress;
    }

    @PostConstruct
    public void ensureTable() {
        jdbc.execute("""
                create table if not exists register_interest_notification_log (
                    id bigserial primary key,
                    submitted_email text not null,
                    recipient_email text,
                    status text not null,
                    resend_id text,
                    error_message text,
                    created_at timestamp with time zone not null default now()
                )
                """);
    }

    public void notifyNewRegistration(String firstName, String lastName, String company, String email, String phone) {
        if (apiKey == null || apiKey.isBlank() || "re_xxxxxxxxx".equals(apiKey.trim())) {
            System.err.println("Register interest notification skipped: RESEND_API_KEY is not configured.");
            recordNotification(email, null, "Skipped", null, "RESEND_API_KEY is not configured.");
            return;
        }

        String fullName = (safe(firstName) + " " + safe(lastName)).trim();
        Map<String, String> values = templateValues(fullName, company, email, phone);
        Map<String, String> templates = adminSettingsService.getRegisterInterestEmailTemplates();
        EmailContent confirmation = resolveTemplate(
                "registration_confirmation",
                templates.get("confirmationSubject"),
                templates.get("confirmationHtml"),
                values);
        EmailContent notification = resolveTemplate(
                "new_registration_notification",
                templates.get("notificationSubject"),
                templates.get("notificationHtml"),
                values);

        Resend resend = new Resend(apiKey.trim());
        sendWithResend(
                resend,
                email,
                confirmation.subject(),
                confirmation.html(),
                email);

        List<String> recipients = adminSettingsService.getRegisterInterestNotificationEmails();
        if (recipients.isEmpty()) {
            System.out.println("Register interest notification skipped: no admin recipients configured.");
            recordNotification(email, null, "Skipped", null, "No admin recipients configured.");
            return;
        }
        for (String recipient : recipients) {
            sendWithResend(
                    resend,
                    recipient,
                    notification.subject(),
                    notification.html(),
                    email);
        }
    }

    private void sendWithResend(
            Resend resend,
            String recipient,
            String subject,
            String html,
            String submittedEmail) {
        try {
            EmailTemplateImageService.PreparedEmail prepared =
                    emailTemplateImageService.inlineImages(html);
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(fromAddress)
                    .to(recipient)
                    .subject(subject)
                    .html(prepared.html())
                    .attachments(prepared.attachments())
                    .build();
            CreateEmailResponse response = sendEmailWithRetry(resend, params, recipient);
            System.out.println("Register interest email sent via Resend to "
                    + recipient + ": " + response.getId());
            recordNotification(submittedEmail, recipient, "Sent", response.getId(), null);
        } catch (ResendException e) {
            System.err.println("Failed to send register interest email via Resend to "
                    + recipient + ": " + e.getMessage());
            recordNotification(submittedEmail, recipient, "Failed", null, e.getMessage());
        } catch (Exception e) {
            System.err.println("Failed to send register interest email to "
                    + recipient + ": " + e.getMessage());
            recordNotification(submittedEmail, recipient, "Failed", null, e.getMessage());
        } finally {
            sleepQuietly(BETWEEN_EMAIL_DELAY_MS);
        }
    }

    private CreateEmailResponse sendEmailWithRetry(
            Resend resend,
            CreateEmailOptions params,
            String recipient) throws ResendException {
        long backoffMs = INITIAL_BACKOFF_MS;
        ResendException lastException = null;

        for (int attempt = 1; attempt <= MAX_RESEND_ATTEMPTS; attempt++) {
            try {
                return resend.emails().send(params);
            } catch (ResendException e) {
                lastException = e;
                if (!isRateLimit(e) || attempt == MAX_RESEND_ATTEMPTS) {
                    throw e;
                }

                System.err.println("Resend rate limit for " + recipient
                        + "; retrying in " + backoffMs + "ms"
                        + " (attempt " + attempt + " of " + MAX_RESEND_ATTEMPTS + ").");
                sleepQuietly(backoffMs);
                backoffMs *= 2;
            }
        }

        throw lastException;
    }

    private boolean isRateLimit(ResendException e) {
        return e.getStatusCode() != null && e.getStatusCode() == 429;
    }

    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void recordNotification(
            String submittedEmail,
            String recipientEmail,
            String status,
            String resendId,
            String errorMessage) {
        try {
            jdbc.update("""
                    insert into register_interest_notification_log
                        (submitted_email, recipient_email, status, resend_id, error_message)
                    values (?, ?, ?, ?, ?)
                    """, submittedEmail, recipientEmail, status, resendId, errorMessage);
        } catch (Exception e) {
            System.err.println("Failed to record register interest notification log: " + e.getMessage());
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String escapeHtml(String value) {
        return safe(value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private Map<String, String> templateValues(String fullName, String company, String email, String phone) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("name", fullName.isBlank() ? "there" : fullName);
        values.put("email", safe(email));
        values.put("company", company == null || company.isBlank() ? "-" : company);
        values.put("phone", phone == null || phone.isBlank() ? "-" : phone);
        return values;
    }

    private String renderTemplate(String template, Map<String, String> values) {
        String rendered = template == null ? "" : template;
        for (Map.Entry<String, String> entry : values.entrySet()) {
            rendered = rendered.replace("{{" + entry.getKey() + "}}", escapeHtml(entry.getValue()));
        }
        return rendered;
    }

    EmailContent resolveTemplate(
            String key,
            String fallbackSubject,
            String fallbackHtml,
            Map<String, String> values) {
        try {
            SystemEmailTemplateService.RenderedTemplate rendered =
                    systemEmailTemplateService.render(key, values);
            return new EmailContent(rendered.subject(), rendered.htmlBody());
        } catch (RuntimeException ignored) {
            return new EmailContent(
                    renderTemplate(fallbackSubject, values),
                    renderTemplate(fallbackHtml, values));
        }
    }

    record EmailContent(String subject, String html) {}
}
