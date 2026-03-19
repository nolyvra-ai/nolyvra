package com.depthhire.app.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class UserService {

    private final JdbcTemplate jdbc;

    // SHA-256 of "123456" — set when admin onboards a registered user
    private static final String DEFAULT_PASSWORD_HASH =
            "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";

    public UserService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── Change password ──────────────────────────────────────────────────────
    // Verifies the current password matches what is stored, then updates to new.
    // Returns false if the current password is wrong.
    //
    // NOTE: This implementation stores passwords as plain text matching your
    // existing login table. If you add hashing later (e.g. BCrypt), replace
    // the SELECT check and UPDATE with hashed equivalents.

    public boolean changePassword(String loginId, String currentPassword, String newPassword) {

        // 1. Verify current password
        var rows = jdbc.query("""
                select id from login
                where id = ? and password_hash = ?
                """,
                (rs, r) -> rs.getString("id"),
                loginId, currentPassword);

        if (rows.isEmpty()) {
            // Current password does not match
            return false;
        }

        // 2. Update to new password
        jdbc.update("""
                update login
                set password_hash = ?
                where id = ?
                """, newPassword, loginId);

        return true;
    }

    // ─── Register interest (landing page) ────────────────────────────────────
    // Saves a new user with plan_id = 'registered' and empty password.
    // Returns false if the email already exists.

    public boolean registerInterest(String firstName, String lastName,
                                    String company, String email, String phone) {
        // Use email as loginId — check for duplicate
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
    // Returns user map on success, empty Optional on failure.
    // Returns a map with expired=true if free plan is older than 30 days.

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

        // Check 30-day expiry for free plan
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

        // Remove internal fields before returning
        user.remove("createdAt");
        return Optional.of(user);
    }

    // ─── Admin check ──────────────────────────────────────────────────────────

    public boolean isAdmin(String loginId) {
        var rows = jdbc.query(
                "select id from login where id = ? and plan_id = 'admin'",
                (rs, r) -> rs.getString("id"), loginId);
        return !rows.isEmpty();
    }

    // ─── Get all users for admin panel ────────────────────────────────────────

    public List<Map<String, Object>> getAllUsersForAdmin() {
        return jdbc.query("""
                select l.id, l.name, l.plan_id, l.phone_number, l.created_at,
                       coalesce(p.name, l.plan_id) as plan_name,
                       l.tokens_remaining
                from login l
                left join plans p on p.id = l.plan_id
                order by l.created_at desc
                """,
                (rs, r) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",              rs.getString("id"));
                    m.put("name",            rs.getString("name"));
                    m.put("planId",          rs.getString("plan_id"));
                    m.put("planName",        rs.getString("plan_name"));
                    m.put("phone",           rs.getString("phone_number"));
                    m.put("tokensRemaining", rs.getObject("tokens_remaining"));
                    OffsetDateTime created = rs.getObject("created_at", OffsetDateTime.class);
                    m.put("createdAt", created != null ? created.toString() : null);
                    return m;
                });
    }

    // ─── Onboard a registered user ────────────────────────────────────────────
    // Sets the default password hash and promotes to plan-free

    public void onboardUser(String targetLoginId) {
        jdbc.update("""
                update login
                set password_hash = ?,
                    plan_id  = 'plan-free',
                    tokens_remaining = 100,
                    renew_date = current_date + INTERVAL '30 days'
                where id = ?
                """, DEFAULT_PASSWORD_HASH, targetLoginId);
    }
}