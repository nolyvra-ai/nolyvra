package com.nolyvra.app.service;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class OnboardingEmailService {

    private static final int MAX_RESEND_ATTEMPTS = 4;
    private static final long INITIAL_BACKOFF_MS = 700L;
    private static final long BETWEEN_EMAIL_DELAY_MS = 550L;
    private static final String TEMPORARY_PASSWORD = "Welcome1";

    private final AdminSettingsService adminSettingsService;
    private final JdbcTemplate jdbc;
    private final String apiKey;
    private final String fromAddress;

    public OnboardingEmailService(
            AdminSettingsService adminSettingsService,
            JdbcTemplate jdbc,
            @Value("${resend.api-key:}") String apiKey,
            @Value("${resend.from:Nolyvra <onboarding@resend.dev>}") String fromAddress) {
        this.adminSettingsService = adminSettingsService;
        this.jdbc = jdbc;
        this.apiKey = apiKey;
        this.fromAddress = fromAddress;
    }

    @PostConstruct
    public void ensureTable() {
        jdbc.execute("""
                create table if not exists onboarding_email_log (
                    id bigserial primary key,
                    target_login_id text not null,
                    recipient_email text,
                    email_type text not null,
                    status text not null,
                    resend_id text,
                    error_message text,
                    created_at timestamp with time zone not null default now()
                )
                """);
    }

    public OnboardingEmailResult sendOnboardingEmails(String targetLoginId, String adminLoginId) {
        Optional<OnboardedUser> user = findOnboardedUser(targetLoginId);
        if (user.isEmpty()) {
            String message = "Onboarding email skipped: onboarded user not found: " + targetLoginId;
            System.err.println(message);
            recordEmail(targetLoginId, null, "User", "Failed", null, message);
            return new OnboardingEmailResult(false, false, 0, 0, message);
        }

        if (apiKey == null || apiKey.isBlank() || "re_xxxxxxxxx".equals(apiKey.trim())) {
            String message = "Onboarding email skipped: RESEND_API_KEY is not configured.";
            System.err.println(message);
            recordEmail(targetLoginId, user.get().email(), "User", "Skipped", null, message);
            return new OnboardingEmailResult(false, false, 0, 0, message);
        }

        OnboardedUser target = user.get();
        if (target.email() == null || target.email().isBlank()) {
            String message = "Onboarding email skipped: onboarded user has no email address.";
            System.err.println(message);
            recordEmail(targetLoginId, null, "User", "Failed", null, message);
            return new OnboardingEmailResult(false, false, 0, 0, message);
        }

        Resend resend = new Resend(apiKey.trim());
        Map<String, String> values = templateValues(target, adminLoginId);
        Map<String, String> templates = adminSettingsService.getOnboardingEmailTemplates();

        boolean userEmailSent = sendWithResend(
                resend,
                target.email(),
                renderTemplate(templates.get("confirmationSubject"), values),
                renderTemplate(templates.get("confirmationHtml"), values),
                targetLoginId,
                "User");

        if (!userEmailSent) {
            return new OnboardingEmailResult(false, false, 0, 0,
                    "Onboarded user email failed; internal notifications were not sent.");
        }

        List<String> recipients = adminSettingsService.getOnboardingNotificationEmails();
        if (recipients.isEmpty()) {
            System.out.println("Onboarding internal notification skipped: no recipients configured.");
            recordEmail(targetLoginId, null, "Internal", "Skipped", null, "No recipients configured.");
            return new OnboardingEmailResult(true, false, 0, 0, null);
        }

        int sent = 0;
        int failed = 0;
        for (String recipient : recipients) {
            boolean ok = sendWithResend(
                    resend,
                    recipient,
                    renderTemplate(templates.get("notificationSubject"), values),
                    renderTemplate(templates.get("notificationHtml"), values),
                    targetLoginId,
                    "Internal");
            if (ok) {
                sent++;
            } else {
                failed++;
            }
        }

        return new OnboardingEmailResult(true, sent > 0, sent, failed, null);
    }

    private boolean sendWithResend(
            Resend resend,
            String recipient,
            String subject,
            String html,
            String targetLoginId,
            String emailType) {
        try {
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(fromAddress)
                    .to(recipient)
                    .subject(subject)
                    .html(html)
                    .build();
            CreateEmailResponse response = sendEmailWithRetry(resend, params, recipient);
            System.out.println("Onboarding email sent via Resend to "
                    + recipient + ": " + response.getId());
            recordEmail(targetLoginId, recipient, emailType, "Sent", response.getId(), null);
            return true;
        } catch (ResendException e) {
            System.err.println("Failed to send onboarding email via Resend to "
                    + recipient + ": " + e.getMessage());
            recordEmail(targetLoginId, recipient, emailType, "Failed", null, e.getMessage());
            return false;
        } catch (Exception e) {
            System.err.println("Failed to send onboarding email to "
                    + recipient + ": " + e.getMessage());
            recordEmail(targetLoginId, recipient, emailType, "Failed", null, e.getMessage());
            return false;
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

    private Optional<OnboardedUser> findOnboardedUser(String loginId) {
        if (loginId == null || loginId.isBlank()) {
            return Optional.empty();
        }

        return jdbc.query("""
                select id, name, email, company, created_at
                from login
                where id = ? or email = ?
                limit 1
                """,
                (rs, rowNum) -> new OnboardedUser(
                        rs.getString("id"),
                        rs.getString("name"),
                        rs.getString("email"),
                        rs.getString("company"),
                        rs.getObject("created_at", OffsetDateTime.class)),
                loginId, loginId).stream().findFirst();
    }

    private void recordEmail(
            String targetLoginId,
            String recipientEmail,
            String emailType,
            String status,
            String resendId,
            String errorMessage) {
        try {
            jdbc.update("""
                    insert into onboarding_email_log
                        (target_login_id, recipient_email, email_type, status, resend_id, error_message)
                    values (?, ?, ?, ?, ?, ?)
                    """, targetLoginId, recipientEmail, emailType, status, resendId, errorMessage);
        } catch (Exception e) {
            System.err.println("Failed to record onboarding email log: " + e.getMessage());
        }
    }

    private Map<String, String> templateValues(OnboardedUser target, String adminLoginId) {
        String displayName = target.name() == null || target.name().isBlank() ? target.id() : target.name();
        Map<String, String> values = new LinkedHashMap<>();
        values.put("name", escapeHtml(displayName));
        values.put("email", escapeHtml(target.email()));
        values.put("company", escapeHtml(target.company() == null || target.company().isBlank() ? "-" : target.company()));
        values.put("password", escapeHtml(TEMPORARY_PASSWORD));
        values.put("adminLoginId", escapeHtml(adminLoginId));
        return values;
    }

    private String renderTemplate(String template, Map<String, String> values) {
        String rendered = template == null ? "" : template;
        for (Map.Entry<String, String> entry : values.entrySet()) {
            rendered = rendered.replace("{{" + entry.getKey() + "}}", entry.getValue());
            rendered = rendered.replace("{" + entry.getKey() + "}", entry.getValue());
        }
        return rendered;
    }

    private String escapeHtml(String value) {
        return (value == null ? "" : value.trim())
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private record OnboardedUser(
            String id,
            String name,
            String email,
            String company,
            OffsetDateTime createdAt) {}

    public record OnboardingEmailResult(
            boolean userEmailSent,
            boolean internalNotificationSent,
            int internalNotificationsSent,
            int internalNotificationsFailed,
            String errorMessage) {}
}
