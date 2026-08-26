package com.nolyvra.app.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.util.Locale;
import java.util.Map;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    public enum AccountType {
        TENANT,
        EMPLOYEE
    }

    private static final int TOKEN_BYTES = 32;
    private static final int MIN_PASSWORD_LENGTH = 8;

    private final JdbcTemplate jdbc;
    private final ResendEmailService resendEmailService;
    private final SystemEmailTemplateService systemEmailTemplateService;
    private final String frontendUrl;
    private final int tokenTtlMinutes;
    private final Clock clock;
    private final SecureRandom secureRandom;

    @Autowired
    public PasswordResetService(
            JdbcTemplate jdbc,
            ResendEmailService resendEmailService,
            SystemEmailTemplateService systemEmailTemplateService,
            @Value("${password-reset.frontend-url:http://localhost:5173}") String frontendUrl,
            @Value("${password-reset.token-ttl-minutes:30}") int tokenTtlMinutes) {
        this(jdbc, resendEmailService, systemEmailTemplateService,
                frontendUrl, tokenTtlMinutes, Clock.systemUTC(), new SecureRandom());
    }

    PasswordResetService(
            JdbcTemplate jdbc,
            ResendEmailService resendEmailService,
            SystemEmailTemplateService systemEmailTemplateService,
            String frontendUrl,
            int tokenTtlMinutes,
            Clock clock,
            SecureRandom secureRandom) {
        this.jdbc = jdbc;
        this.resendEmailService = resendEmailService;
        this.systemEmailTemplateService = systemEmailTemplateService;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
        this.tokenTtlMinutes = tokenTtlMinutes;
        this.clock = clock;
        this.secureRandom = secureRandom;
    }

    /**
     * Starts a reset only when the account exists. Callers must always return the
     * same response so this method cannot be used to discover registered emails.
     */
    @Transactional
    public void requestReset(String email) {
        requestReset(email, AccountType.TENANT);
    }

    @Transactional
    public void requestReset(String email, AccountType accountType) {
        String normalizedEmail = normalizeEmail(email);
        if (accountType == AccountType.EMPLOYEE) {
            requestEmployeeReset(normalizedEmail);
            return;
        }

        List<Account> accounts = jdbc.query("""
                select id, email
                from login
                where lower(email) = ?
                """,
                (rs, rowNum) -> new Account(rs.getString("id"), rs.getString("email")),
                normalizedEmail);

        if (accounts.isEmpty()) {
            return;
        }

        Account account = accounts.get(0);
        Integer recentRequests = jdbc.queryForObject("""
                select count(*)
                from password_reset_tokens
                where login_id = ?
                  and used_at is null
                  and created_at > now() - interval '60 seconds'
                """, Integer.class, account.id());
        if (recentRequests != null && recentRequests > 0) {
            return;
        }

        jdbc.update("""
                update password_reset_tokens
                set used_at = ?
                where login_id = ?
                  and used_at is null
                """, OffsetDateTime.now(clock), account.id());

        String rawToken = generateToken();
        OffsetDateTime now = OffsetDateTime.now(clock);
        jdbc.update("""
                insert into password_reset_tokens
                    (token_hash, login_id, created_at, expires_at)
                values (?, ?, ?, ?)
                """, hash(rawToken), account.id(), now, now.plusMinutes(tokenTtlMinutes));

        sendResetEmail(account.email(), rawToken, AccountType.TENANT);
    }

    public boolean isTokenValid(String rawToken) {
        return isTokenValid(rawToken, AccountType.TENANT);
    }

    public boolean isTokenValid(String rawToken, AccountType accountType) {
        if (rawToken == null || rawToken.isBlank()) {
            return false;
        }
        if (accountType == AccountType.EMPLOYEE) {
            Integer matches = jdbc.queryForObject("""
                    select count(*)
                    from employee_password_reset_tokens prt
                    join employees e on e.id = prt.employee_id
                    where prt.token_hash = ?
                      and prt.used_at is null
                      and prt.expires_at > now()
                      and e.is_active = true
                    """, Integer.class, hash(rawToken));
            return matches != null && matches > 0;
        }

        Integer matches = jdbc.queryForObject("""
                select count(*)
                from password_reset_tokens
                where token_hash = ?
                  and used_at is null
                  and expires_at > now()
                """, Integer.class, hash(rawToken));
        return matches != null && matches > 0;
    }

    @Transactional
    public boolean resetPassword(String rawToken, String newPassword) {
        return resetPassword(rawToken, newPassword, AccountType.TENANT);
    }

    @Transactional
    public boolean resetPassword(String rawToken, String newPassword, AccountType accountType) {
        if (rawToken == null || rawToken.isBlank()
                || newPassword == null || newPassword.length() < MIN_PASSWORD_LENGTH) {
            return false;
        }

        if (accountType == AccountType.EMPLOYEE) {
            return resetEmployeePassword(rawToken, newPassword);
        }

        List<String> loginIds = jdbc.query("""
                update password_reset_tokens
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
        jdbc.update("""
                update login
                set password_hash = ?, updated_at = ?
                where id = ?
                """, hash(newPassword), OffsetDateTime.now(clock), loginId);
        jdbc.update("""
                update user_sessions
                set is_active = false
                where login_id = ? and is_active = true
                """, loginId);
        return true;
    }

    private void requestEmployeeReset(String normalizedEmail) {
        List<Account> employees = jdbc.query("""
                select id, email
                from employees
                where lower(email) = ?
                  and is_active = true
                order by created_at
                limit 1
                """,
                (rs, rowNum) -> new Account(rs.getString("id"), rs.getString("email")),
                normalizedEmail);
        if (employees.isEmpty()) {
            return;
        }

        Account employee = employees.get(0);
        Integer recentRequests = jdbc.queryForObject("""
                select count(*)
                from employee_password_reset_tokens
                where employee_id = ?
                  and used_at is null
                  and created_at > now() - interval '60 seconds'
                """, Integer.class, employee.id());
        if (recentRequests != null && recentRequests > 0) {
            return;
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        jdbc.update("""
                update employee_password_reset_tokens
                set used_at = ?
                where employee_id = ?
                  and used_at is null
                """, now, employee.id());

        String rawToken = generateToken();
        jdbc.update("""
                insert into employee_password_reset_tokens
                    (token_hash, employee_id, created_at, expires_at)
                values (?, ?, ?, ?)
                """, hash(rawToken), employee.id(), now, now.plusMinutes(tokenTtlMinutes));
        sendResetEmail(employee.email(), rawToken, AccountType.EMPLOYEE);
    }

    private boolean resetEmployeePassword(String rawToken, String newPassword) {
        List<String> employeeIds = jdbc.query("""
                update employee_password_reset_tokens prt
                set used_at = ?
                from employees e
                where prt.token_hash = ?
                  and prt.used_at is null
                  and prt.expires_at > now()
                  and e.id = prt.employee_id
                  and e.is_active = true
                returning prt.employee_id
                """,
                (rs, rowNum) -> rs.getString("employee_id"),
                OffsetDateTime.now(clock), hash(rawToken));
        if (employeeIds.isEmpty()) {
            return false;
        }

        String employeeId = employeeIds.get(0);
        jdbc.update("""
                update employees
                set password_hash = ?, updated_at = ?
                where id = ? and is_active = true
                """, hash(newPassword), OffsetDateTime.now(clock), employeeId);
        jdbc.update("""
                update employee_sessions
                set is_active = false
                where employee_id = ? and is_active = true
                """, employeeId);
        return true;
    }

    private void sendResetEmail(String email, String rawToken, AccountType accountType) {
        String accountQuery = accountType == AccountType.EMPLOYEE ? "&type=employee" : "";
        String resetUrl = frontendUrl + "/reset-password?token=" + rawToken + accountQuery;
        log.info("Password reset email URL: accountType={}, url={}/reset-password?token=[REDACTED]{}",
                accountType.name().toLowerCase(Locale.ROOT), frontendUrl, accountQuery);
        String subject = "Reset your nolyvra password";
        String body = defaultResetBody(resetUrl);
        String htmlBody = defaultResetHtml(resetUrl);
        try {
            SystemEmailTemplateService.RenderedTemplate rendered = systemEmailTemplateService.render(
                    "password_reset",
                    Map.of(
                            "reset_link", resetUrl,
                            "expiry_minutes", String.valueOf(tokenTtlMinutes),
                            "account_type", accountType.name().toLowerCase(Locale.ROOT)));
            subject = rendered.subject();
            body = rendered.textBody();
            htmlBody = rendered.htmlBody();
        } catch (RuntimeException ignored) {
            // Password reset is essential: database/template failures use the built-in copy.
        }
        resendEmailService.sendHtml(
                email,
                subject,
                body,
                htmlBody);
    }

    private String defaultResetBody(String resetUrl) {
        return """
                We received a request to reset your nolyvra password.

                Use this link within %d minutes:
                %s

                If you did not request a password reset, you can ignore this email.
                """.formatted(tokenTtlMinutes, resetUrl);
    }

    private String defaultResetHtml(String resetUrl) {
        return """
                <p>We received a request to reset your nolyvra password.</p>
                <p><a href="%s">Reset your password</a></p>
                <p>This link expires in %d minutes.</p>
                <p>If you did not request a password reset, you can ignore this email.</p>
                """.formatted(resetUrl, tokenTtlMinutes);
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
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

    private record Account(String id, String email) {}
}
