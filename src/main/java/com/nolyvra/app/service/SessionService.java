package com.nolyvra.app.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class SessionService {

    private static final int SESSION_HOURS = 4;

    private final JdbcTemplate jdbc;

    public SessionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // A sub-user's session stores the PARENT's loginId (so every existing
    // loginId-scoped query in the app naturally operates on the owner's
    // tenant data) plus actorLoginId identifying the real person who
    // authenticated, so privileged actions can be gated on their actual
    // identity regardless of which loginId a request carries.
    public record TenantSessionInfo(String loginId, String actorLoginId) {
        public boolean isSubUser() { return actorLoginId != null; }
    }

    // Creates a new session. actorLoginId is null for an owner's own login;
    // set to the sub-user's own login.id when a sub-user authenticates.
    // Invalidates the same real person's prior sessions only — scoping
    // invalidation by tenant loginId would log out the whole team whenever
    // any one of them (owner or any sub-user) logs in.
    public String createSession(String loginId, String actorLoginId) {
        String identityKey = actorLoginId != null ? actorLoginId : loginId;
        jdbc.update("""
                update user_sessions
                set is_active = false
                where is_active = true
                  and coalesce(actor_login_id, login_id) = ?
                """, identityKey);

        UUID token = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        jdbc.update("""
                insert into user_sessions (token, login_id, actor_login_id, created_at, expires_at, is_active)
                values (?::uuid, ?, ?, ?, ?, true)
                """,
                token.toString(), loginId, actorLoginId, now, now.plusHours(SESSION_HOURS));

        return token.toString();
    }

    public String createSession(String loginId) {
        return createSession(loginId, null);
    }

    // Returns the effective tenant loginId + actual actor identity if the
    // token is valid, active, and not expired.
    public Optional<TenantSessionInfo> validateSession(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        try {
            List<TenantSessionInfo> rows = jdbc.query("""
                    select login_id, actor_login_id from user_sessions
                    where token = ?::uuid
                      and is_active = true
                      and expires_at > now()
                    """,
                    (rs, r) -> new TenantSessionInfo(rs.getString("login_id"), rs.getString("actor_login_id")),
                    token);
            return rows.stream().findFirst();
        } catch (Exception e) {
            System.err.println("[SessionService] validateSession() failed: " + e.getMessage());
            return Optional.empty();
        }
    }

    // Marks a session inactive — used on explicit logout.
    public void invalidateSession(String token) {
        if (token == null || token.isBlank()) return;
        try {
            jdbc.update("""
                    update user_sessions
                    set is_active = false
                    where token = ?::uuid
                    """, token);
        } catch (Exception e) {
            System.err.println("[SessionService] invalidateSession() failed: " + e.getMessage());
        }
    }

    // Runs at 02:00 every night — deletes expired session rows from the table.
    @Scheduled(cron = "0 0 2 * * *")
    public void cleanupExpiredSessions() {
        try {
            int deleted = jdbc.update("delete from user_sessions where expires_at < now()");
            if (deleted > 0) {
                System.out.println("[SessionService] Cleaned up " + deleted + " expired session(s).");
            }
            int deletedEmp = jdbc.update("delete from employee_sessions where expires_at < now()");
            if (deletedEmp > 0) {
                System.out.println("[SessionService] Cleaned up " + deletedEmp + " expired employee session(s).");
            }
        } catch (Exception e) {
            System.err.println("[SessionService] cleanupExpiredSessions() failed: " + e.getMessage());
        }
    }

    // ─── Employee sessions ────────────────────────────────────────────────────
    // Mirrors the tenant session methods above, backed by a separate table so
    // tenant login behavior is untouched.

    public record EmployeeSessionInfo(String employeeId, String loginId) {}

    public String createEmployeeSession(String employeeId, String loginId) {
        jdbc.update("""
                update employee_sessions
                set is_active = false
                where employee_id = ? and is_active = true
                """, employeeId);

        UUID token = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        jdbc.update("""
                insert into employee_sessions (token, employee_id, login_id, created_at, expires_at, is_active)
                values (?::uuid, ?, ?, ?, ?, true)
                """,
                token.toString(), employeeId, loginId, now, now.plusHours(SESSION_HOURS));

        return token.toString();
    }

    public Optional<EmployeeSessionInfo> validateEmployeeSession(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        try {
            List<EmployeeSessionInfo> rows = jdbc.query("""
                    select employee_id, login_id from employee_sessions
                    where token = ?::uuid
                      and is_active = true
                      and expires_at > now()
                    """,
                    (rs, r) -> new EmployeeSessionInfo(rs.getString("employee_id"), rs.getString("login_id")),
                    token);
            return rows.stream().findFirst();
        } catch (Exception e) {
            System.err.println("[SessionService] validateEmployeeSession() failed: " + e.getMessage());
            return Optional.empty();
        }
    }

    public void invalidateEmployeeSession(String token) {
        if (token == null || token.isBlank()) return;
        try {
            jdbc.update("""
                    update employee_sessions
                    set is_active = false
                    where token = ?::uuid
                    """, token);
        } catch (Exception e) {
            System.err.println("[SessionService] invalidateEmployeeSession() failed: " + e.getMessage());
        }
    }
}
