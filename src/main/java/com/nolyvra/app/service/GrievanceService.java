package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class GrievanceService {

    private static final Set<String> VALID_STEPS = Set.of(
            "investigated", "hr_reviewed", "resolved", "closed"
    );

    private final JdbcTemplate jdbc;

    public GrievanceService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── List ─────────────────────────────────────────────────────────────────

    public List<GrievanceResponse> listByEmployee(String employeeId, String loginId) {
        return jdbc.queryForList(
                BASE_SQL + " WHERE g.login_id = ? AND g.employee_id = ? AND g.is_active = true" +
                " ORDER BY g.created_at DESC", loginId, employeeId)
                .stream().map(this::map).toList();
    }

    public List<GrievanceResponse> listAll(String loginId, String status) {
        var sql = new StringBuilder(BASE_SQL + " WHERE g.login_id = ? AND g.is_active = true");
        var p   = new java.util.ArrayList<Object>();
        p.add(loginId);
        if (status != null && !status.isBlank()) { sql.append(" AND g.status = ?"); p.add(status); }
        sql.append(" ORDER BY g.created_at DESC");
        return jdbc.queryForList(sql.toString(), p.toArray()).stream().map(this::map).toList();
    }

    // ─── Create (multipart) ───────────────────────────────────────────────────

    public GrievanceResponse create(String employeeId, GrievanceCreateRequest req,
                                     MultipartFile complaint, String loginId) {
        String id    = "grv-" + UUID.randomUUID();
        byte[] data  = null;
        String cName = null;
        if (complaint != null && !complaint.isEmpty()) {
            try { data = complaint.getBytes(); cName = complaint.getOriginalFilename(); }
            catch (IOException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read complaint file"); }
        }
        jdbc.update("""
                INSERT INTO grievance
                  (id, login_id, employee_id, title, description, complaint_name, complaint_data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                id, loginId, employeeId,
                req.title(), req.description(),
                cName, data);
        return getById(id, loginId);
    }

    // ─── Update step ──────────────────────────────────────────────────────────

    public GrievanceResponse updateStep(String id, WorkflowStepRequest req, String loginId) {
        if (!VALID_STEPS.contains(req.step()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid step: " + req.step());
        requireOwned(id, loginId, "IN_PROGRESS");
        String col = "step_" + req.step();
        jdbc.update("UPDATE grievance SET " + col + " = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                req.checked(), id, loginId);
        return getById(id, loginId);
    }

    // ─── Resolve (all steps done) ─────────────────────────────────────────────

    public GrievanceResponse resolve(String id, String resolutionNotes, String loginId) {
        GrievanceResponse g = requireOwned(id, loginId, "IN_PROGRESS");
        if (!g.stepInvestigated() || !g.stepHrReviewed() || !g.stepResolved() || !g.stepClosed())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "All stages must be completed before resolving");
        jdbc.update("UPDATE grievance SET status = 'RESOLVED', resolution_notes = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                resolutionNotes, id, loginId);
        return getById(id, loginId);
    }

    // ─── Reject / Cancel ──────────────────────────────────────────────────────

    public GrievanceResponse reject(String id, String loginId) {
        requireOwned(id, loginId, "IN_PROGRESS");
        jdbc.update("UPDATE grievance SET status = 'REJECTED', updated_at = now() WHERE id = ? AND login_id = ?",
                id, loginId);
        return getById(id, loginId);
    }

    public void cancel(String id, String loginId) {
        requireOwned(id, loginId, "IN_PROGRESS");
        jdbc.update("UPDATE grievance SET status = 'CANCELLED', updated_at = now(), is_active = false WHERE id = ? AND login_id = ?",
                id, loginId);
    }

    // ─── Complaint download ───────────────────────────────────────────────────

    public Map<String, Object> getComplaintRaw(String id, String loginId) {
        var rows = jdbc.queryForList(
                "SELECT complaint_name, complaint_data FROM grievance WHERE id = ? AND login_id = ?",
                id, loginId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Grievance not found");
        return rows.get(0);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static final String BASE_SQL = """
            SELECT g.id, g.login_id, g.employee_id, e.first_name, e.last_name,
                   g.title, g.description, g.complaint_name, g.resolution_notes, g.status,
                   g.step_investigated, g.step_hr_reviewed, g.step_resolved, g.step_closed,
                   g.created_at, g.updated_at
            FROM grievance g
            JOIN employees e ON e.id = g.employee_id
            """;

    private GrievanceResponse getById(String id, String loginId) {
        return jdbc.queryForList(BASE_SQL + " WHERE g.id = ? AND g.login_id = ?", id, loginId)
                .stream().map(this::map).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Grievance not found: " + id));
    }

    private GrievanceResponse requireOwned(String id, String loginId, String requiredStatus) {
        GrievanceResponse g = getById(id, loginId);
        if (!g.status().equals(requiredStatus))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Grievance is not in " + requiredStatus + " status");
        return g;
    }

    private GrievanceResponse map(Map<String, Object> row) {
        Timestamp cre = (Timestamp) row.get("created_at");
        Timestamp upd = (Timestamp) row.get("updated_at");
        return new GrievanceResponse(
                (String) row.get("id"),
                (String) row.get("login_id"),
                (String) row.get("employee_id"),
                (String) row.get("first_name"),
                (String) row.get("last_name"),
                (String) row.get("title"),
                (String) row.get("description"),
                (String) row.get("complaint_name"),
                (String) row.get("resolution_notes"),
                (String) row.get("status"),
                Boolean.TRUE.equals(row.get("step_investigated")),
                Boolean.TRUE.equals(row.get("step_hr_reviewed")),
                Boolean.TRUE.equals(row.get("step_resolved")),
                Boolean.TRUE.equals(row.get("step_closed")),
                cre != null ? cre.toInstant() : null,
                upd != null ? upd.toInstant() : null
        );
    }
}
