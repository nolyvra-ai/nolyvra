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
public class DisciplinaryService {

    private static final Set<String> VALID_STEPS = Set.of(
            "investigated", "manager_reviewed", "hr_decided"
    );

    private final JdbcTemplate jdbc;

    public DisciplinaryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── List ─────────────────────────────────────────────────────────────────

    public List<DisciplinaryActionResponse> listByEmployee(String employeeId, String loginId) {
        return jdbc.queryForList(
                BASE_SQL + " WHERE da.login_id = ? AND da.employee_id = ? AND da.is_active = true" +
                " ORDER BY da.created_at DESC", loginId, employeeId)
                .stream().map(r -> map(r, loadCorrectiveActions((String) r.get("id"), loginId))).toList();
    }

    public List<DisciplinaryActionResponse> listAll(String loginId, String status) {
        var sql = new StringBuilder(BASE_SQL + " WHERE da.login_id = ? AND da.is_active = true");
        var p   = new java.util.ArrayList<Object>();
        p.add(loginId);
        if (status != null && !status.isBlank()) { sql.append(" AND da.status = ?"); p.add(status); }
        sql.append(" ORDER BY da.created_at DESC");
        return jdbc.queryForList(sql.toString(), p.toArray()).stream()
                .map(r -> map(r, loadCorrectiveActions((String) r.get("id"), loginId))).toList();
    }

    // ─── Create (multipart — incident report) ────────────────────────────────

    public DisciplinaryActionResponse create(String employeeId, DisciplinaryActionCreateRequest req,
                                              MultipartFile incidentReport, String loginId) {
        String id    = "disc-" + UUID.randomUUID();
        byte[] data  = null;
        String rName = null;
        if (incidentReport != null && !incidentReport.isEmpty()) {
            try { data = incidentReport.getBytes(); rName = incidentReport.getOriginalFilename(); }
            catch (IOException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read incident report"); }
        }
        jdbc.update("""
                INSERT INTO disciplinary_action
                  (id, login_id, employee_id, title, incident_description, incident_report_name, incident_report_data, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id, loginId, employeeId,
                req.title(), req.incidentDescription(),
                rName, data, req.notes());
        return getById(id, loginId);
    }

    // ─── Upload HR decision ───────────────────────────────────────────────────

    public DisciplinaryActionResponse uploadHrDecision(String id, MultipartFile file, String loginId) {
        if (file == null || file.isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No file provided");
        byte[] data;
        try { data = file.getBytes(); }
        catch (IOException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read HR decision file"); }
        jdbc.update("UPDATE disciplinary_action SET hr_decision_name = ?, hr_decision_data = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                file.getOriginalFilename(), data, id, loginId);
        return getById(id, loginId);
    }

    // ─── Update checklist step ────────────────────────────────────────────────

    public DisciplinaryActionResponse updateStep(String id, WorkflowStepRequest req, String loginId) {
        if (!VALID_STEPS.contains(req.step()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid step: " + req.step());
        requireOwned(id, loginId, "IN_PROGRESS");
        String col = "step_" + req.step();
        jdbc.update("UPDATE disciplinary_action SET " + col + " = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                req.checked(), id, loginId);
        return getById(id, loginId);
    }

    // ─── Corrective action plan ───────────────────────────────────────────────

    public DisciplinaryActionResponse addCorrectiveAction(String id, CorrectiveActionItemRequest req, String loginId) {
        requireOwned(id, loginId, "IN_PROGRESS");
        String itemId = "ca-" + UUID.randomUUID();
        int order = req.sortOrder() != null ? req.sortOrder()
                : jdbc.queryForObject("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM disciplinary_corrective_action WHERE disciplinary_action_id = ?",
                        Integer.class, id);
        jdbc.update("""
                INSERT INTO disciplinary_corrective_action
                  (id, login_id, disciplinary_action_id, item_text, sort_order)
                VALUES (?, ?, ?, ?, ?)
                """, itemId, loginId, id, req.itemText(), order);
        return getById(id, loginId);
    }

    public DisciplinaryActionResponse toggleCorrectiveAction(String id, String itemId, boolean done, String loginId) {
        jdbc.update("UPDATE disciplinary_corrective_action SET is_done = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                done, itemId, loginId);
        return getById(id, loginId);
    }

    public DisciplinaryActionResponse deleteCorrectiveAction(String id, String itemId, String loginId) {
        jdbc.update("DELETE FROM disciplinary_corrective_action WHERE id = ? AND login_id = ? AND disciplinary_action_id = ?",
                itemId, loginId, id);
        return getById(id, loginId);
    }

    // ─── Close ───────────────────────────────────────────────────────────────

    public DisciplinaryActionResponse close(String id, String loginId) {
        DisciplinaryActionResponse da = requireOwned(id, loginId, "IN_PROGRESS");
        if (!da.stepInvestigated() || !da.stepManagerReviewed() || !da.stepHrDecided())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "All checklist steps must be completed before closing");
        jdbc.update("UPDATE disciplinary_action SET status = 'CLOSED', updated_at = now() WHERE id = ? AND login_id = ?",
                id, loginId);
        return getById(id, loginId);
    }

    // ─── Cancel ──────────────────────────────────────────────────────────────

    public void cancel(String id, String loginId) {
        requireOwned(id, loginId, "IN_PROGRESS");
        jdbc.update("UPDATE disciplinary_action SET status = 'CANCELLED', updated_at = now(), is_active = false WHERE id = ? AND login_id = ?",
                id, loginId);
    }

    // ─── File downloads ───────────────────────────────────────────────────────

    public Map<String, Object> getIncidentReportRaw(String id, String loginId) {
        var rows = jdbc.queryForList(
                "SELECT incident_report_name, incident_report_data FROM disciplinary_action WHERE id = ? AND login_id = ?",
                id, loginId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Disciplinary action not found");
        return rows.get(0);
    }

    public Map<String, Object> getHrDecisionRaw(String id, String loginId) {
        var rows = jdbc.queryForList(
                "SELECT hr_decision_name, hr_decision_data FROM disciplinary_action WHERE id = ? AND login_id = ?",
                id, loginId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Disciplinary action not found");
        return rows.get(0);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static final String BASE_SQL = """
            SELECT da.id, da.login_id, da.employee_id, e.first_name, e.last_name,
                   da.title, da.incident_description, da.incident_report_name,
                   da.hr_decision_name, da.notes, da.status,
                   da.step_investigated, da.step_manager_reviewed, da.step_hr_decided,
                   da.created_at, da.updated_at
            FROM disciplinary_action da
            JOIN employees e ON e.id = da.employee_id
            """;

    private DisciplinaryActionResponse getById(String id, String loginId) {
        return jdbc.queryForList(BASE_SQL + " WHERE da.id = ? AND da.login_id = ?", id, loginId)
                .stream().map(r -> map(r, loadCorrectiveActions(id, loginId))).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Disciplinary action not found: " + id));
    }

    private DisciplinaryActionResponse requireOwned(String id, String loginId, String requiredStatus) {
        DisciplinaryActionResponse da = getById(id, loginId);
        if (!da.status().equals(requiredStatus))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Action is not in " + requiredStatus + " status");
        return da;
    }

    private List<CorrectiveActionItemResponse> loadCorrectiveActions(String disciplinaryId, String loginId) {
        return jdbc.queryForList(
                "SELECT id, item_text, is_done, sort_order FROM disciplinary_corrective_action" +
                " WHERE disciplinary_action_id = ? AND login_id = ? ORDER BY sort_order, created_at",
                disciplinaryId, loginId)
                .stream().map(r -> new CorrectiveActionItemResponse(
                        (String)  r.get("id"),
                        (String)  r.get("item_text"),
                        Boolean.TRUE.equals(r.get("is_done")),
                        r.get("sort_order") instanceof Number n ? n.intValue() : 0
                )).toList();
    }

    private DisciplinaryActionResponse map(Map<String, Object> row, List<CorrectiveActionItemResponse> items) {
        Timestamp cre = (Timestamp) row.get("created_at");
        Timestamp upd = (Timestamp) row.get("updated_at");
        return new DisciplinaryActionResponse(
                (String) row.get("id"),
                (String) row.get("login_id"),
                (String) row.get("employee_id"),
                (String) row.get("first_name"),
                (String) row.get("last_name"),
                (String) row.get("title"),
                (String) row.get("incident_description"),
                (String) row.get("incident_report_name"),
                (String) row.get("hr_decision_name"),
                (String) row.get("notes"),
                (String) row.get("status"),
                Boolean.TRUE.equals(row.get("step_investigated")),
                Boolean.TRUE.equals(row.get("step_manager_reviewed")),
                Boolean.TRUE.equals(row.get("step_hr_decided")),
                items,
                cre != null ? cre.toInstant() : null,
                upd != null ? upd.toInstant() : null
        );
    }
}
