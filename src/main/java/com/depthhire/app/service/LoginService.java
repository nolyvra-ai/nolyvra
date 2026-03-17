package com.depthhire.app.service;

import com.depthhire.app.model.LoginRequest;
import com.depthhire.app.model.LoginResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class LoginService {

    private final JdbcTemplate jdbc;

    public LoginService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<LoginResponse> LOGIN_MAPPER = (rs, rowNum) -> {
        OffsetDateTime created = rs.getObject("created_at", OffsetDateTime.class);
        return new LoginResponse(
                rs.getString("id"),
                rs.getString("name"),
                rs.getString("company"),
                rs.getString("email"),
                created != null ? created.toInstant() : null
        );
    };

    public Optional<LoginResponse> login(LoginRequest req) {
        List<LoginResponse> rows = jdbc.query("""
                select id, name, company, email, created_at
                from login
                where email = ?
                  and password_hash = ?
                """,
                LOGIN_MAPPER,
                req.email(),
                req.passwordHash()
        );

        return rows.stream().findFirst();
    }

    public boolean changePassword(String loginId, String currentPassword, String newPassword) {
    // Verify current password matches what's stored
    List<String> rows = jdbc.query(
            "select id from logins where id = ? and password = ?",
            (rs, r) -> rs.getString("id"),
            loginId, currentPassword);

    if (rows.isEmpty()) {
        return false; // current password is wrong
    }

    // Update to new password
    jdbc.update(
            "update logins set password = ? where id = ?",
            newPassword, loginId);

    return true;
}
}