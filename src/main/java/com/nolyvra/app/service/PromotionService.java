package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class PromotionService {

    private static final Set<String> VALID_STEPS = Set.of(
            "recommendation_reviewed", "performance_validated",
            "leadership_approved", "compensation_reviewed"
    );

    private final JdbcTemplate jdbc;

    public PromotionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── List ─────────────────────────────────────────────────────────────────

    public List<PromotionRequestResponse> listByEmployee(String employeeId, String loginId) {
        return jdbc.queryForList(
                BASE_SQL + " WHERE pr.login_id = ? AND pr.employee_id = ? AND pr.is_active = true" +
                " ORDER BY pr.created_at DESC", loginId, employeeId)
                .stream().map(this::map).toList();
    }

    public List<PromotionRequestResponse> listAll(String loginId, String status) {
        StringBuilder sql = new StringBuilder(BASE_SQL + " WHERE pr.login_id = ? AND pr.is_active = true");
        java.util.ArrayList<Object> p = new java.util.ArrayList<>();
        p.add(loginId);
        if (status != null && !status.isBlank()) { sql.append(" AND pr.status = ?"); p.add(status); }
        sql.append(" ORDER BY pr.created_at DESC");
        return jdbc.queryForList(sql.toString(), p.toArray()).stream().map(this::map).toList();
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    public PromotionRequestResponse create(String employeeId, PromotionRequestCreateRequest req, String loginId) {
        // enforce one active promotion per employee at a time
        int active = jdbc.queryForObject(
                "SELECT COUNT(*) FROM promotion_request WHERE login_id = ? AND employee_id = ? " +
                "AND status = 'IN_PROGRESS' AND is_active = true", Integer.class, loginId, employeeId);
        if (active > 0) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "An in-progress promotion request already exists for this employee");

        // snapshot current role
        String currentRole = jdbc.queryForObject(
                "SELECT job_title FROM employees WHERE id = ? AND login_id = ? AND is_active = true",
                String.class, employeeId, loginId);

        String id = "prom-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO promotion_request
                  (id, login_id, employee_id, previous_role, proposed_role, promotion_effective, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, loginId, employeeId, currentRole,
                req.proposedRole().trim(),
                req.promotionEffective() != null ? Date.valueOf(req.promotionEffective()) : null,
                req.notes());
        return getById(id, loginId);
    }

    // ─── Update step ──────────────────────────────────────────────────────────

    public PromotionRequestResponse updateStep(String id, WorkflowStepRequest req, String loginId) {
        if (!VALID_STEPS.contains(req.step())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid step: " + req.step());
        }
        requireOwned(id, loginId, "IN_PROGRESS");
        String col = "step_" + req.step();
        jdbc.update("UPDATE promotion_request SET " + col + " = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                req.checked(), id, loginId);
        return getById(id, loginId);
    }

    // ─── Approve ─────────────────────────────────────────────────────────────

    public PromotionRequestResponse approve(String id, String loginId) {
        PromotionRequestResponse pr = requireOwned(id, loginId, "IN_PROGRESS");
        if (!pr.stepRecommendationReviewed() || !pr.stepPerformanceValidated()
                || !pr.stepLeadershipApproved() || !pr.stepCompensationReviewed()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "All checklist steps must be completed before approving");
        }
        // approve the request
        jdbc.update("UPDATE promotion_request SET status = 'APPROVED', updated_at = now() WHERE id = ? AND login_id = ?",
                id, loginId);
        // update employee
        jdbc.update("""
                UPDATE employees SET job_title = ?, promotion_effective = ?, updated_at = now()
                WHERE id = ? AND login_id = ? AND is_active = true
                """,
                pr.proposedRole(),
                pr.promotionEffective() != null ? Date.valueOf(pr.promotionEffective()) : null,
                pr.employeeId(), loginId);
        return getById(id, loginId);
    }

    // ─── Reject / Cancel ──────────────────────────────────────────────────────

    public PromotionRequestResponse reject(String id, String loginId) {
        requireOwned(id, loginId, "IN_PROGRESS");
        jdbc.update("UPDATE promotion_request SET status = 'REJECTED', updated_at = now() WHERE id = ? AND login_id = ?",
                id, loginId);
        return getById(id, loginId);
    }

    public void cancel(String id, String loginId) {
        requireOwned(id, loginId, "IN_PROGRESS");
        jdbc.update("UPDATE promotion_request SET status = 'CANCELLED', updated_at = now(), is_active = false WHERE id = ? AND login_id = ?",
                id, loginId);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static final String BASE_SQL = """
            SELECT pr.id, pr.login_id, pr.employee_id, e.first_name, e.last_name,
                   pr.previous_role, pr.proposed_role, pr.promotion_effective, pr.notes, pr.status,
                   pr.step_recommendation_reviewed, pr.step_performance_validated,
                   pr.step_leadership_approved, pr.step_compensation_reviewed,
                   pr.created_at, pr.updated_at
            FROM promotion_request pr
            JOIN employees e ON e.id = pr.employee_id
            """;

    private PromotionRequestResponse getById(String id, String loginId) {
        return jdbc.queryForList(BASE_SQL +
                " WHERE pr.id = ? AND pr.login_id = ?", id, loginId)
                .stream().map(this::map).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Promotion request not found: " + id));
    }

    private PromotionRequestResponse requireOwned(String id, String loginId, String requiredStatus) {
        PromotionRequestResponse pr = getById(id, loginId);
        if (!pr.status().equals(requiredStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Request is not in " + requiredStatus + " status");
        }
        return pr;
    }

    private PromotionRequestResponse map(Map<String, Object> row) {
        Date promoEff   = (Date) row.get("promotion_effective");
        Timestamp cre   = (Timestamp) row.get("created_at");
        Timestamp upd   = (Timestamp) row.get("updated_at");
        return new PromotionRequestResponse(
                (String) row.get("id"),
                (String) row.get("login_id"),
                (String) row.get("employee_id"),
                (String) row.get("first_name"),
                (String) row.get("last_name"),
                (String) row.get("previous_role"),
                (String) row.get("proposed_role"),
                promoEff != null ? promoEff.toLocalDate() : null,
                (String) row.get("notes"),
                (String) row.get("status"),
                Boolean.TRUE.equals(row.get("step_recommendation_reviewed")),
                Boolean.TRUE.equals(row.get("step_performance_validated")),
                Boolean.TRUE.equals(row.get("step_leadership_approved")),
                Boolean.TRUE.equals(row.get("step_compensation_reviewed")),
                cre != null ? cre.toInstant() : null,
                upd != null ? upd.toInstant() : null
        );
    }
}
