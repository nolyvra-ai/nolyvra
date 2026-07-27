package com.nolyvra.app.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class UserService {

    private final JdbcTemplate jdbc;
    private final SessionService sessionService;
    private final OnboardingEmailService onboardingEmailService;

    // SHA-256 of "123456" — set when admin onboards a registered user
   /* private static final String DEFAULT_PASSWORD_HASH =
            "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";*/ 

    // SHA-256 of "Welcome1" — set when admin onboards a registered user
    private static final String DEFAULT_PASSWORD_HASH =
            "7e19e31ae82d749034fc921f777f717ba5b57c6add9add889eb536ac6effcde0";

    public UserService(
            JdbcTemplate jdbc,
            SessionService sessionService,
            OnboardingEmailService onboardingEmailService) {
        this.jdbc = jdbc;
        this.sessionService = sessionService;
        this.onboardingEmailService = onboardingEmailService;
    }

    // ─── Change password ──────────────────────────────────────────────────────

    public boolean changePassword(String loginId, String currentPassword, String newPassword) {

        var rows = jdbc.query("""
                select id from login
                where id = ? and password_hash = ?
                """,
                (rs, r) -> rs.getString("id"),
                loginId, currentPassword);

        if (rows.isEmpty()) {
            return false;
        }

        jdbc.update("""
                update login
                set password_hash = ?
                where id = ?
                """, newPassword, loginId);

        return true;
    }

    // ─── Register interest (landing page) ────────────────────────────────────

    public boolean registerInterest(String firstName, String lastName,
                                    String company, String email, String phone) {
        // Pre-check against email (the column the unique constraint is actually
        // on) rather than id — id isn't guaranteed to equal email for every row.
        List<String> existing = jdbc.query(
                "select id from login where email = ?",
                (rs, r) -> rs.getString("id"), email);
        if (!existing.isEmpty()) return false;

        String name = (firstName + " " + lastName).trim();
        try {
            jdbc.update("""
                    insert into login (id, name, company, email, password_hash, plan_id, phone_number, created_at)
                    values (?, ?, ?, ?, '', 'registered', ?, now())
                    """, email, name, company, email, phone.isBlank() ? null : phone);
        } catch (DuplicateKeyException e) {
            // Safety net for a concurrent registration racing the pre-check above.
            return false;
        }

        return true;
    }

    // ─── Login ────────────────────────────────────────────────────────────────

    public Optional<Map<String, Object>> login(String loginId, String password) {
        var rows = jdbc.query("""
                select l.id, l.name, l.plan_id, l.created_at
                from login l
                where l.id = ? and l.password_hash = ?
                """,
                (rs, r) -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id",        rs.getString("id"));
                    m.put("name",      rs.getString("name"));
                    m.put("planId",    rs.getString("plan_id"));
                    m.put("createdAt", rs.getObject("created_at", OffsetDateTime.class));
                    return m;
                }, loginId, password);

        if (rows.isEmpty()) return Optional.empty();

        Map<String, Object> user = rows.get(0);
        String planId = (String) user.get("planId");

        if ("plan-free".equals(planId)) {
            OffsetDateTime createdAt = (OffsetDateTime) user.get("createdAt");
            if (createdAt != null) {
                LocalDate expiryDate = createdAt.toLocalDate().plusDays(30);
                if (LocalDate.now().isAfter(expiryDate)) {
                    Map<String, Object> expired = new HashMap<>();
                    expired.put("expired", true);
                    expired.put("error",
                        "Your free trial has expired. Please contact us to update your plan.");
                    return Optional.of(expired);
                }
            }
        }

        user.remove("createdAt");
        String sessionToken = sessionService.createSession(loginId);
        user.put("sessionToken", sessionToken);
        return Optional.of(user);
    }

    // ─── Admin check ──────────────────────────────────────────────────────────

    public boolean isAdmin(String loginId) {
        var rows = jdbc.query(
                "select id from login where (id = ? or email = ?) and plan_id = 'admin'",
                (rs, r) -> rs.getString("id"), loginId, loginId);
        return !rows.isEmpty();
    }

    // ─── Get all users for admin panel ────────────────────────────────────────
    // Change 1: include additional_tokens, additional_jobs, additional_candidates

    public List<Map<String, Object>> getAllUsersForAdmin() {
        return jdbc.query("""
                select l.id, l.name, l.plan_id, l.phone_number, l.created_at,
                       coalesce(p.name, l.plan_id) as plan_name,
                       l.tokens_remaining,
                       coalesce(l.additional_tokens, 0)     as additional_tokens,
                       coalesce(l.additional_jobs, 0)       as additional_jobs,
                       coalesce(l.additional_candidates, 0) as additional_candidates
                from login l
                left join plans p on p.id = l.plan_id
                order by l.created_at desc
                """,
                (rs, r) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",                   rs.getString("id"));
                    m.put("name",                 rs.getString("name"));
                    m.put("planId",               rs.getString("plan_id"));
                    m.put("planName",             rs.getString("plan_name"));
                    m.put("phone",                rs.getString("phone_number"));
                    m.put("tokensRemaining",      rs.getObject("tokens_remaining"));
                    m.put("additionalTokens",     rs.getInt("additional_tokens"));
                    m.put("additionalJobs",       rs.getInt("additional_jobs"));
                    m.put("additionalCandidates", rs.getInt("additional_candidates"));
                    OffsetDateTime created = rs.getObject("created_at", OffsetDateTime.class);
                    m.put("createdAt", created != null ? created.toString() : null);
                    return m;
                });
    }

    // ─── Onboard a registered user ────────────────────────────────────────────

    public Map<String, Object> onboardUser(String targetLoginId, String adminLoginId) {
        jdbc.update("""
                update login
                set password_hash = ?,
                    plan_id  = 'plan-free',
                    tokens_remaining = 100,
                    renew_date = current_date + INTERVAL '30 days'
                where id = ?
                """, DEFAULT_PASSWORD_HASH, targetLoginId);

        OnboardingEmailService.OnboardingEmailResult emailResult =
                onboardingEmailService.sendOnboardingEmails(targetLoginId, adminLoginId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "onboarded");
        result.put("userEmailSent", emailResult.userEmailSent());
        result.put("internalNotificationSent", emailResult.internalNotificationSent());
        result.put("internalNotificationsSent", emailResult.internalNotificationsSent());
        result.put("internalNotificationsFailed", emailResult.internalNotificationsFailed());
        if (emailResult.errorMessage() != null && !emailResult.errorMessage().isBlank()) {
            result.put("emailError", emailResult.errorMessage());
        }
        return result;
    }

    // ─── Update additional limits for a user (admin only) ────────────────────
    // Change 2: new method to set extra tokens/jobs/candidates on top of plan limits

    public void updateAdditionalLimits(String targetLoginId, int additionalTokens,
                                        int additionalJobs, int additionalCandidates) {
        // Read current additional_tokens so we can compute the delta
        Integer currentAdditional = jdbc.queryForObject(
                "select coalesce(additional_tokens, 0) from login where id = ?",
                Integer.class, targetLoginId);
        int previousAdditional = currentAdditional != null ? currentAdditional : 0;
        int tokenDelta = additionalTokens - previousAdditional;

        if (tokenDelta > 0) {
            // Grant has increased — top up tokens_remaining by the delta
            jdbc.update("""
                    update login
                    set additional_tokens     = ?,
                        additional_jobs       = ?,
                        additional_candidates = ?,
                        tokens_remaining      = tokens_remaining + ?
                    where id = ?
                    """, additionalTokens, additionalJobs, additionalCandidates, tokenDelta, targetLoginId);
        } else {
            // Grant unchanged or reduced — just update the limits, don't touch tokens_remaining
            jdbc.update("""
                    update login
                    set additional_tokens     = ?,
                        additional_jobs       = ?,
                        additional_candidates = ?
                    where id = ?
                    """, additionalTokens, additionalJobs, additionalCandidates, targetLoginId);
        }
    }
}
