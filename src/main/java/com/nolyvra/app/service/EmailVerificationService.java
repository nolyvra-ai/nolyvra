package com.nolyvra.app.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class EmailVerificationService {

    private static final int TOKEN_BYTES = 32;
    private static final int MIN_PASSWORD_LENGTH = 8;

    private final JdbcTemplate jdbc;
    private final ResendEmailService resendEmailService;
    private final SystemEmailTemplateService systemEmailTemplateService;
    private final AdminSettingsService adminSettingsService;
    private final String frontendUrl;
    private final int tokenTtlHours;
    private final Clock clock;
    private final SecureRandom secureRandom;

    @Autowired
    public EmailVerificationService(
            JdbcTemplate jdbc,
            ResendEmailService resendEmailService,
            SystemEmailTemplateService systemEmailTemplateService,
            AdminSettingsService adminSettingsService,
            @Value("${email-verification.frontend-url:http://localhost:5173}") String frontendUrl,
            @Value("${email-verification.token-ttl-hours:48}") int tokenTtlHours) {
        this(jdbc, resendEmailService, systemEmailTemplateService, adminSettingsService,
                frontendUrl, tokenTtlHours, Clock.systemUTC(), new SecureRandom());
    }

    EmailVerificationService(
            JdbcTemplate jdbc,
            ResendEmailService resendEmailService,
            SystemEmailTemplateService systemEmailTemplateService,
            AdminSettingsService adminSettingsService,
            String frontendUrl,
            int tokenTtlHours,
            Clock clock,
            SecureRandom secureRandom) {
        this.jdbc = jdbc;
        this.resendEmailService = resendEmailService;
        this.systemEmailTemplateService = systemEmailTemplateService;
        this.adminSettingsService = adminSettingsService;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
        this.tokenTtlHours = tokenTtlHours;
        this.clock = clock;
        this.secureRandom = secureRandom;
    }

    @Transactional
    public void sendVerificationEmail(String loginId, String email) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        jdbc.update("""
                update email_verification_tokens
                set used_at = ?
                where login_id = ?
                  and used_at is null
                """, now, loginId);

        String rawToken = generateToken();
        jdbc.update("""
                insert into email_verification_tokens
                    (token_hash, login_id, created_at, expires_at)
                values (?, ?, ?, ?)
                """, hash(rawToken), loginId, now, now.plusHours(tokenTtlHours));

        sendVerificationLinkEmail(email, rawToken);
    }

    public boolean isTokenValid(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return false;
        }
        Integer matches = jdbc.queryForObject("""
                select count(*)
                from email_verification_tokens
                where token_hash = ?
                  and used_at is null
                  and expires_at > now()
                """, Integer.class, hash(rawToken));
        return matches != null && matches > 0;
    }

    @Transactional
    public boolean completeVerification(String rawToken, String newPassword) {
        if (rawToken == null || rawToken.isBlank()
                || newPassword == null || newPassword.length() < MIN_PASSWORD_LENGTH) {
            return false;
        }

        List<String> loginIds = jdbc.query("""
                update email_verification_tokens
                set used_at = ?
                where token_hash = ?
                  and used_at is null
                  and expires_at > now()
                returning login_id
                """,
                (rs, rowNum) -> rs.getString("login_id"),
                OffsetDateTime.now(clock), hash(rawToken));
        if (loginIds.isEmpty()) {
            return false;
        }

        String loginId = loginIds.get(0);
        List<Map<String, Object>> onboarded = jdbc.queryForList("""
                update login
                set password_hash = ?,
                    plan_id = 'plan-free',
                    tokens_remaining = 100,
                    renew_date = current_date + interval '30 days',
                    email_verified_at = ?,
                    updated_at = ?
                where id = ? and plan_id = 'registered'
                returning id, name, email, company
                """, hash(newPassword), OffsetDateTime.now(clock), OffsetDateTime.now(clock), loginId);

        if (onboarded.isEmpty()) {
            // Token was valid but the account was already onboarded (e.g. a race
            // or a re-click) — treat as success without re-sending welcome emails.
            return true;
        }

        Map<String, Object> account = onboarded.get(0);
        sendWelcomeEmail((String) account.get("email"), (String) account.get("name"));
        notifyAdminsOfAutoOnboarding(
                (String) account.get("name"), (String) account.get("email"), (String) account.get("company"));
        return true;
    }

    private void sendVerificationLinkEmail(String email, String rawToken) {
        String verifyUrl = frontendUrl + "/verify-email?token=" + rawToken;
        String subject = "Verify your email for nolyvra";
        String body = defaultVerificationBody(verifyUrl);
        String htmlBody = defaultVerificationHtml(verifyUrl);
        try {
            SystemEmailTemplateService.RenderedTemplate rendered = systemEmailTemplateService.render(
                    "email_verification",
                    Map.of(
                            "verify_link", verifyUrl,
                            "expiry_hours", String.valueOf(tokenTtlHours)));
            subject = rendered.subject();
            body = rendered.textBody();
            htmlBody = rendered.htmlBody();
        } catch (RuntimeException ignored) {
            // Verification is essential: database/template failures use the built-in copy.
        }
        resendEmailService.sendHtml(email, subject, body, htmlBody);
    }

    private void sendWelcomeEmail(String email, String name) {
        String loginUrl = frontendUrl + "/login";
        String subject = "Your nolyvra account is active";
        String body = """
                Hi %s,

                Your email is verified and your nolyvra account is now active on the free plan.

                Log in here: %s

                Welcome aboard!
                """.formatted(name, loginUrl);
        String htmlBody = """
                <p>Hi %s,</p>
                <p>Your email is verified and your nolyvra account is now active on the free plan.</p>
                <p><a href="%s">Log in to nolyvra</a></p>
                <p>Welcome aboard!</p>
                """.formatted(name, loginUrl);
        resendEmailService.sendHtml(email, subject, body, htmlBody);
    }

    private void notifyAdminsOfAutoOnboarding(String name, String email, String company) {
        List<String> recipients = adminSettingsService.getOnboardingNotificationEmails();
        if (recipients == null || recipients.isEmpty()) {
            return;
        }
        String subject = "New self-service signup onboarded";
        String body = """
                A new account was automatically onboarded after email verification.

                Name: %s
                Email: %s
                Company: %s
                """.formatted(name, email, company == null ? "" : company);
        for (String recipient : recipients) {
            resendEmailService.sendText(recipient, subject, body);
        }
    }

    private String defaultVerificationBody(String verifyUrl) {
        return """
                Thanks for registering interest in nolyvra.

                Verify your email and set your password within %d hours:
                %s

                If you did not request this, you can ignore this email.
                """.formatted(tokenTtlHours, verifyUrl);
    }

    private String defaultVerificationHtml(String verifyUrl) {
        return """
                <p>Thanks for registering interest in nolyvra.</p>
                <p><a href="%s">Verify your email and set your password</a></p>
                <p>This link expires in %d hours.</p>
                <p>If you did not request this, you can ignore this email.</p>
                """.formatted(verifyUrl, tokenTtlHours);
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
