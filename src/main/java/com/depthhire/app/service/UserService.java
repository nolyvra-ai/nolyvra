package com.depthhire.app.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final JdbcTemplate jdbc;

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
                where id = ? and password = ?
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
                set password = ?
                where id = ?
                """, newPassword, loginId);

        return true;
    }
}
