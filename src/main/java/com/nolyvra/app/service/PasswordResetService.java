package com.nolyvra.app.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
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

@Service
public class PasswordResetService {

    private static final int TOKEN_BYTES = 32;
    private static final int MIN_PASSWORD_LENGTH = 8;

    private final JdbcTemplate jdbc;
    private final ResendEmailService resendEmailService;
    private final String frontendUrl;
    private final int tokenTtlMinutes;
    private final Clock clock;
    private final SecureRandom secureRandom;

    @Autowired
    public PasswordResetService(
            JdbcTemplate jdbc,
            ResendEmailService resendEmailService,
            @Value("${password-reset.frontend-url:http://localhost:5173}") String frontendUrl,
            @Value("${password-reset.token-ttl-minutes:30}") int tokenTtlMinutes) {
        this(jdbc, resendEmailService, frontendUrl, tokenTtlMinutes, Clock.systemUTC(), new SecureRandom());
    }

    PasswordResetService(
            JdbcTemplate jdbc,
            ResendEmailService resendEmailService,
            String frontendUrl,
            int tokenTtlMinutes,
            Clock clock,
            SecureRandom secureRandom) {
        this.jdbc = jdbc;
        this.resendEmailService = resendEmailService;
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
        String normalizedEmail = normalizeEmail(email);
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
                """, Integer.class, account.loginId());
        if (recentRequests != null && recentRequests > 0) {
            return;
        }

        jdbc.update("""
                update password_reset_tokens
                set used_at = ?
                where login_id = ?
                  and used_at is null
                """, OffsetDateTime.now(clock), account.loginId());

        String rawToken = generateToken();
        OffsetDateTime now = OffsetDateTime.now(clock);
        jdbc.update("""
                insert into password_reset_tokens
                    (token_hash, login_id, created_at, expires_at)
                values (?, ?, ?, ?)
                """, hash(rawToken), account.loginId(), now, now.plusMinutes(tokenTtlMinutes));

        String resetUrl = frontendUrl + "/reset-password?token=" + rawToken;
        resendEmailService.sendText(
                account.email(),
                "Reset your nolyvra password",
                """
                We received a request to reset your nolyvra password.

                Use this link within %d minutes:
                %s

                If you did not request a password reset, you can ignore this email.
                """.formatted(tokenTtlMinutes, resetUrl));
    }

    public boolean isTokenValid(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return false;
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
        if (rawToken == null || rawToken.isBlank()
                || newPassword == null || newPassword.length() < MIN_PASSWORD_LENGTH) {
            return false;
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

    private record Account(String loginId, String email) {}
}
