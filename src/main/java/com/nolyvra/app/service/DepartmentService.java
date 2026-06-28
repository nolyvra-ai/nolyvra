package com.nolyvra.app.service;

import com.nolyvra.app.model.DepartmentCreateRequest;
import com.nolyvra.app.model.DepartmentResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class DepartmentService {

    private final JdbcTemplate jdbc;

    public DepartmentService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private final RowMapper<DepartmentResponse> DEPT_MAPPER = (rs, rowNum) -> {
        OffsetDateTime odt = rs.getObject("created_at", OffsetDateTime.class);
        return new DepartmentResponse(
                rs.getString("id"),
                rs.getString("login_id"),
                rs.getString("name"),
                odt != null ? odt.toInstant() : null
        );
    };

    public List<DepartmentResponse> list(String loginId) {
        return jdbc.query("""
                SELECT id, login_id, name, created_at
                FROM departments
                WHERE login_id = ? AND is_active = true
                ORDER BY name
                """, DEPT_MAPPER, loginId);
    }

    public DepartmentResponse create(DepartmentCreateRequest req, String loginId) {
        String id = "dept-" + UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO departments (id, login_id, name)
                    VALUES (?, ?, ?)
                    """, id, loginId, req.name().trim());
        } catch (Exception e) {
            if (e.getMessage() != null && e.getMessage().contains("uq_departments_login_name")) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Department '" + req.name() + "' already exists");
            }
            throw e;
        }
        return jdbc.query("""
                SELECT id, login_id, name, created_at FROM departments WHERE id = ?
                """, DEPT_MAPPER, id).stream().findFirst().orElseThrow();
    }

    /** Ownership check used by EmployeeService before assigning department. */
    public boolean ownsAndActive(String departmentId, String loginId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM departments WHERE id = ? AND login_id = ? AND is_active = true",
                Integer.class, departmentId, loginId);
        return count != null && count > 0;
    }
}
