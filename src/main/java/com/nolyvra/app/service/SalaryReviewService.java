package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class SalaryReviewService {

    private static final Set<String> VALID_STEPS = Set.of(
            "salary_reviewed", "manager_proposed", "finance_approved", "hr_approved"
    );

    private final JdbcTemplate jdbc;

    public SalaryReviewService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── List ─────────────────────────────────────────────────────────────────

    public List<SalaryReviewResponse> listByEmployee(String employeeId, String loginId) {
        return jdbc.queryForList(
                BASE_SQL + " WHERE sr.login_id = ? AND sr.employee_id = ? AND sr.is_active = true" +
                " ORDER BY sr.created_at DESC", loginId, employeeId)
                .stream().map(this::map).toList();
    }

    public List<SalaryReviewResponse> listAll(String loginId, String status) {
        StringBuilder sql = new StringBuilder(BASE_SQL + " WHERE sr.login_id = ? AND sr.is_active = true");
        java.util.ArrayList<Object> p = new java.util.ArrayList<>();
        p.add(loginId);
        if (status != null && !status.isBlank()) { sql.append(" AND sr.status = ?"); p.add(status); }
        sql.append(" ORDER BY sr.created_at DESC");
        return jdbc.queryForList(sql.toString(), p.toArray()).stream().map(this::map).toList();
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    public SalaryReviewResponse create(String employeeId, SalaryReviewCreateRequest req, String loginId) {
        int active = jdbc.queryForObject(
                "SELECT COUNT(*) FROM salary_review WHERE login_id = ? AND employee_id = ? " +
                "AND status = 'IN_PROGRESS' AND is_active = true", Integer.class, loginId, employeeId);
        if (active > 0) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "An in-progress salary review already exists for this employee");

        // snapshot current salary
        List<BigDecimal> salaries = jdbc.queryForList(
                "SELECT salary FROM employees WHERE id = ? AND login_id = ? AND is_active = true",
                BigDecimal.class, employeeId, loginId);
        BigDecimal currentSalary = salaries.isEmpty() ? null : salaries.get(0);

        String id = "srev-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO salary_review
                  (id, login_id, employee_id, current_salary, proposed_salary, effective_from, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, loginId, employeeId, currentSalary,
                req.proposedSalary(),
                req.effectiveFrom() != null ? Date.valueOf(req.effectiveFrom()) : null,
                req.notes());
        return getById(id, loginId);
    }

    // ─── Update step ──────────────────────────────────────────────────────────

    public SalaryReviewResponse updateStep(String id, WorkflowStepRequest req, String loginId) {
        if (!VALID_STEPS.contains(req.step())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid step: " + req.step());
        }
        requireOwned(id, loginId, "IN_PROGRESS");
        String col = "step_" + req.step();
        jdbc.update("UPDATE salary_review SET " + col + " = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                req.checked(), id, loginId);
        return getById(id, loginId);
    }

    // ─── Approve ─────────────────────────────────────────────────────────────

    public SalaryReviewResponse approve(String id, String loginId) {
        SalaryReviewResponse sr = requireOwned(id, loginId, "IN_PROGRESS");
        if (!sr.stepSalaryReviewed() || !sr.stepManagerProposed()
                || !sr.stepFinanceApproved() || !sr.stepHrApproved()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "All checklist steps must be completed before approving");
        }
        jdbc.update("UPDATE salary_review SET status = 'APPROVED', updated_at = now() WHERE id = ? AND login_id = ?",
                id, loginId);
        jdbc.update("""
                UPDATE employees SET salary = ?, salary_effective_from = ?, updated_at = now()
                WHERE id = ? AND login_id = ? AND is_active = true
                """,
                sr.proposedSalary(),
                sr.effectiveFrom() != null ? Date.valueOf(sr.effectiveFrom()) : null,
                sr.employeeId(), loginId);
        return getById(id, loginId);
    }

    // ─── Reject / Cancel ──────────────────────────────────────────────────────

    public SalaryReviewResponse reject(String id, String loginId) {
        requireOwned(id, loginId, "IN_PROGRESS");
        jdbc.update("UPDATE salary_review SET status = 'REJECTED', updated_at = now() WHERE id = ? AND login_id = ?",
                id, loginId);
        return getById(id, loginId);
    }

    public void cancel(String id, String loginId) {
        requireOwned(id, loginId, "IN_PROGRESS");
        jdbc.update("UPDATE salary_review SET status = 'CANCELLED', updated_at = now(), is_active = false WHERE id = ? AND login_id = ?",
                id, loginId);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static final String BASE_SQL = """
            SELECT sr.id, sr.login_id, sr.employee_id, e.first_name, e.last_name,
                   sr.current_salary, sr.proposed_salary, sr.effective_from,
                   sr.notes, sr.status,
                   sr.step_salary_reviewed, sr.step_manager_proposed,
                   sr.step_finance_approved, sr.step_hr_approved,
                   sr.created_at, sr.updated_at
            FROM salary_review sr
            JOIN employees e ON e.id = sr.employee_id
            """;

    private SalaryReviewResponse getById(String id, String loginId) {
        return jdbc.queryForList(BASE_SQL +
                " WHERE sr.id = ? AND sr.login_id = ?", id, loginId)
                .stream().map(this::map).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Salary review not found: " + id));
    }

    private SalaryReviewResponse requireOwned(String id, String loginId, String requiredStatus) {
        SalaryReviewResponse sr = getById(id, loginId);
        if (!sr.status().equals(requiredStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Review is not in " + requiredStatus + " status");
        }
        return sr;
    }

    private SalaryReviewResponse map(Map<String, Object> row) {
        Date effFrom  = (Date) row.get("effective_from");
        Timestamp cre = (Timestamp) row.get("created_at");
        Timestamp upd = (Timestamp) row.get("updated_at");
        return new SalaryReviewResponse(
                (String) row.get("id"),
                (String) row.get("login_id"),
                (String) row.get("employee_id"),
                (String) row.get("first_name"),
                (String) row.get("last_name"),
                toBD(row.get("current_salary")),
                toBD(row.get("proposed_salary")),
                effFrom != null ? effFrom.toLocalDate() : null,
                (String) row.get("notes"),
                (String) row.get("status"),
                Boolean.TRUE.equals(row.get("step_salary_reviewed")),
                Boolean.TRUE.equals(row.get("step_manager_proposed")),
                Boolean.TRUE.equals(row.get("step_finance_approved")),
                Boolean.TRUE.equals(row.get("step_hr_approved")),
                cre != null ? cre.toInstant() : null,
                upd != null ? upd.toInstant() : null
        );
    }

    private BigDecimal toBD(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal bd) return bd;
        if (v instanceof Number n) return new BigDecimal(n.toString());
        return null;
    }
}
