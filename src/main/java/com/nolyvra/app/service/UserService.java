package com.nolyvra.app.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class UserService {

    private final JdbcTemplate jdbc;
    private final SessionService sessionService;
    private final EmailService emailService;

    // SHA-256 of "123456" — set when admin onboards a registered user
   /* private static final String DEFAULT_PASSWORD_HASH =
            "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";*/ 

    // SHA-256 of "Welcome1" — set when admin onboards a registered user
    private static final String DEFAULT_PASSWORD_HASH =
            "7e19e31ae82d749034fc921f777f717ba5b57c6add9add889eb536ac6effcde0";

    public UserService(JdbcTemplate jdbc, SessionService sessionService, EmailService emailService) {
        this.jdbc = jdbc;
        this.sessionService = sessionService;
        this.emailService = emailService;
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
        List<String> existing = jdbc.query(
                "select id from login where id = ?",
                (rs, r) -> rs.getString("id"), email);
        if (!existing.isEmpty()) return false;

        String name = (firstName + " " + lastName).trim();
        jdbc.update("""
                insert into login (id, name, company, email, password_hash, plan_id, phone_number, created_at)
                values (?, ?, ?, ?, '', 'registered', ?, now())
                """, email, name, company, email, phone.isBlank() ? null : phone);

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

    public void onboardUser(String targetLoginId, String adminLoginId, String emailSubject, String emailBody) {
        jdbc.update("""
                update login
                set password_hash = ?,
                    plan_id  = 'plan-free',
                    tokens_remaining = 100,
                    renew_date = current_date + INTERVAL '30 days'
                where id = ?
                """, DEFAULT_PASSWORD_HASH, targetLoginId);

        sendOnboardingEmails(targetLoginId, adminLoginId, emailSubject, emailBody);
    }

    private void sendOnboardingEmails(String targetLoginId, String adminLoginId, String emailSubject, String emailBody) {
        Optional<UserContact> targetUser = findUserContact(targetLoginId);
        Optional<UserContact> adminUser = findUserContact(adminLoginId);

        if (targetUser.isEmpty()) {
            System.err.println("Skipping onboarding emails: approved user not found: " + targetLoginId);
            return;
        }

        UserContact target = targetUser.get();
        String targetName = target.name() != null && !target.name().isBlank() ? target.name() : target.id();
        String subject = emailSubject != null && !emailSubject.isBlank()
                ? fillApprovalTemplate(emailSubject.trim(), targetName, target.email())
                : defaultApprovalSubject();
        String body = emailBody != null && !emailBody.isBlank()
                ? fillApprovalTemplate(emailBody, targetName, target.email())
                : defaultApprovalBody(targetName);

        emailService.sendSystemEmail(
                target.email(),
                subject,
                body);

        adminUser.ifPresent(admin -> emailService.sendSystemEmail(
                admin.email(),
                "Nolyvra registration approved - " + targetName,
                """
                Hi %s,

                You approved a Nolyvra registration successfully.

                Approved user: %s
                Email: %s
                Plan: Free trial

                Best regards,
                Nolyvra Team
                """.formatted(
                        admin.name() != null && !admin.name().isBlank() ? admin.name() : admin.id(),
                        targetName,
                        target.email())));
    }

    private String defaultApprovalSubject() {
        return "Welcome to Nolyvra - registration approved";
    }

    private String fillApprovalTemplate(String template, String targetName, String targetEmail) {
        return template
                .replace("{name}", targetName)
                .replace("{email}", targetEmail != null ? targetEmail : "")
                .replace("{password}", "Welcome1");
    }

    private String defaultApprovalBody(String targetName) {
        return """
                Hi %s,

                Congratulations, your Nolyvra registration has been approved.

                You can now sign in using your registered email address. Your temporary password is:
                Welcome1

                Please change your password after your first login.

                Best regards,
                Nolyvra Team
                """.formatted(targetName);
    }

    private Optional<UserContact> findUserContact(String loginIdOrEmail) {
        if (loginIdOrEmail == null || loginIdOrEmail.isBlank()) {
            return Optional.empty();
        }

        return jdbc.query("""
                select id, name, email
                from login
                where id = ? or email = ?
                limit 1
                """,
                (rs, r) -> new UserContact(
                        rs.getString("id"),
                        rs.getString("name"),
                        rs.getString("email")),
                loginIdOrEmail, loginIdOrEmail).stream().findFirst();
    }

    private record UserContact(String id, String name, String email) {}

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
