package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;


import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class LeaveService {

    private final JdbcTemplate jdbc;

    public LeaveService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── Seed data ────────────────────────────────────────────────────────────

    private record SeedType(String name, int days, boolean paid, String color) {}

    private static final List<SeedType> SEED_TYPES = List.of(
        new SeedType("Annual Leave",   25, true,  "#1D72E8"),
        new SeedType("Sick Leave",     10, true,  "#16A34A"),
        new SeedType("Parental Leave", 90, true,  "#7C3AED"),
        new SeedType("Study Leave",     5, true,  "#D97706"),
        new SeedType("Unpaid Leave",    0, false, "#8A94A6")
    );

    private void seedDefaultTypes(String loginId) {
        for (SeedType s : SEED_TYPES) {
            String id = "ltyp-" + UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO leave_type (id, login_id, name, default_days_per_year, is_paid, color)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT DO NOTHING
                    """, id, loginId, s.name(), s.days(), s.paid(), s.color());
        }
    }

    // ─── Leave types ──────────────────────────────────────────────────────────

    public List<LeaveTypeResponse> listTypes(String loginId) {
        List<String> ids = jdbc.queryForList(
                "SELECT id FROM leave_type WHERE login_id = ? AND is_active = true ORDER BY created_at",
                String.class, loginId);
        if (ids.isEmpty()) {
            seedDefaultTypes(loginId);
            ids = jdbc.queryForList(
                    "SELECT id FROM leave_type WHERE login_id = ? AND is_active = true ORDER BY created_at",
                    String.class, loginId);
        }
        return ids.stream().map(id -> getType(id, loginId)).toList();
    }

    private LeaveTypeResponse getType(String id, String loginId) {
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT id, login_id, name, default_days_per_year, is_paid, color " +
                "FROM leave_type WHERE id = ? AND login_id = ? AND is_active = true",
                id, loginId);
        return mapType(row);
    }

    private LeaveTypeResponse mapType(Map<String, Object> row) {
        return new LeaveTypeResponse(
                (String) row.get("id"),
                (String) row.get("login_id"),
                (String) row.get("name"),
                ((Number) row.get("default_days_per_year")).intValue(),
                (Boolean) row.get("is_paid"),
                (String) row.get("color")
        );
    }

    public LeaveTypeResponse createType(LeaveTypeRequest req, String loginId) {
        String id = "ltyp-" + UUID.randomUUID();
        String color = (req.color() != null && !req.color().isBlank()) ? req.color() : "#1D72E8";
        jdbc.update("""
                INSERT INTO leave_type (id, login_id, name, default_days_per_year, is_paid, color)
                VALUES (?, ?, ?, ?, ?, ?)
                """, id, loginId, req.name().trim(), req.defaultDaysPerYear(), req.isPaid(), color);
        return getType(id, loginId);
    }

    public LeaveTypeResponse updateType(String id, LeaveTypeRequest req, String loginId) {
        requireTypeOwned(id, loginId);
        String color = (req.color() != null && !req.color().isBlank()) ? req.color() : "#1D72E8";
        jdbc.update("""
                UPDATE leave_type
                SET name = ?, default_days_per_year = ?, is_paid = ?, color = ?
                WHERE id = ? AND login_id = ? AND is_active = true
                """, req.name().trim(), req.defaultDaysPerYear(), req.isPaid(), color, id, loginId);
        return getType(id, loginId);
    }

    public void deleteType(String id, String loginId) {
        requireTypeOwned(id, loginId);
        jdbc.update("UPDATE leave_type SET is_active = false WHERE id = ? AND login_id = ?", id, loginId);
    }

    private void requireTypeOwned(String id, String loginId) {
        int count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM leave_type WHERE id = ? AND login_id = ? AND is_active = true",
                Integer.class, id, loginId);
        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave type not found: " + id);
    }

    // ─── Employee leave balances ──────────────────────────────────────────────

    public List<LeaveBalanceResponse> getEmployeeBalance(String employeeId, int year, String loginId) {
        // ensure all active leave types have a balance row for this employee+year
        List<Map<String, Object>> types = jdbc.queryForList(
                "SELECT id, default_days_per_year FROM leave_type WHERE login_id = ? AND is_active = true",
                loginId);
        for (Map<String, Object> t : types) {
            String typeId = (String) t.get("id");
            int defaultDays = ((Number) t.get("default_days_per_year")).intValue();
            jdbc.update("""
                    INSERT INTO employee_leave_balance
                        (id, login_id, employee_id, leave_type_id, year, allocated_days)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT (login_id, employee_id, leave_type_id, year) DO NOTHING
                    """, "elb-" + UUID.randomUUID(), loginId, employeeId, typeId, year, defaultDays);
        }

        return jdbc.queryForList("""
                SELECT elb.id, elb.employee_id, elb.leave_type_id, elb.year, elb.allocated_days,
                       lt.name AS type_name, lt.color, lt.is_paid,
                       COALESCE((
                           SELECT SUM(lr.days_requested)
                           FROM leave_request lr
                           WHERE lr.employee_id = elb.employee_id
                             AND lr.leave_type_id = elb.leave_type_id
                             AND EXTRACT(YEAR FROM lr.start_date) = elb.year
                             AND lr.status = 'APPROVED'
                             AND lr.is_active = true
                       ), 0) AS used_days
                FROM employee_leave_balance elb
                JOIN leave_type lt ON lt.id = elb.leave_type_id
                WHERE elb.login_id = ? AND elb.employee_id = ? AND elb.year = ? AND elb.is_active = true
                ORDER BY lt.created_at
                """, loginId, employeeId, year)
                .stream()
                .map(row -> {
                    BigDecimal allocated = toBigDecimal(row.get("allocated_days"));
                    BigDecimal used      = toBigDecimal(row.get("used_days"));
                    BigDecimal remaining = allocated.subtract(used);
                    return new LeaveBalanceResponse(
                            (String) row.get("id"),
                            (String) row.get("employee_id"),
                            (String) row.get("leave_type_id"),
                            (String) row.get("type_name"),
                            (String) row.get("color"),
                            (Boolean) row.get("is_paid"),
                            year,
                            allocated, used, remaining
                    );
                }).toList();
    }

    public LeaveBalanceResponse setEmployeeBalance(String employeeId, String leaveTypeId,
                                                    SetLeaveBalanceRequest req, String loginId) {
        requireTypeOwned(leaveTypeId, loginId);
        int year = req.year() > 0 ? req.year() : LocalDate.now().getYear();
        jdbc.update("""
                INSERT INTO employee_leave_balance
                    (id, login_id, employee_id, leave_type_id, year, allocated_days)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (login_id, employee_id, leave_type_id, year)
                DO UPDATE SET allocated_days = EXCLUDED.allocated_days, updated_at = now()
                """, "elb-" + UUID.randomUUID(), loginId, employeeId, leaveTypeId, year, req.allocatedDays());

        return getEmployeeBalance(employeeId, year, loginId)
                .stream()
                .filter(b -> b.leaveTypeId().equals(leaveTypeId))
                .findFirst()
                .orElseThrow();
    }

    // ─── Leave requests ───────────────────────────────────────────────────────

    public List<LeaveRequestResponse> listRequests(String loginId, String status, String employeeId) {
        StringBuilder sql = new StringBuilder("""
                SELECT lr.id, lr.employee_id, e.first_name, e.last_name,
                       lr.leave_type_id, lt.name AS type_name, lt.color,
                       lr.start_date, lr.end_date, lr.days_requested, lr.reason,
                       lr.status, lr.approver_comment, lr.actioned_at, lr.created_at
                FROM leave_request lr
                JOIN employees e  ON e.id  = lr.employee_id
                JOIN leave_type lt ON lt.id = lr.leave_type_id
                WHERE lr.login_id = ? AND lr.is_active = true
                """);
        java.util.ArrayList<Object> params = new java.util.ArrayList<>();
        params.add(loginId);
        if (status != null && !status.isBlank()) { sql.append(" AND lr.status = ?"); params.add(status); }
        if (employeeId != null && !employeeId.isBlank()) { sql.append(" AND lr.employee_id = ?"); params.add(employeeId); }
        sql.append(" ORDER BY lr.created_at DESC");
        return jdbc.queryForList(sql.toString(), params.toArray()).stream().map(this::mapRequest).toList();
    }

    public LeaveRequestResponse submitRequest(String employeeId, LeaveRequestCreateRequest req, String loginId) {
        if (req.endDate().isBefore(req.startDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date must not be before start date");
        }
        requireTypeOwned(req.leaveTypeId(), loginId);

        String id = "lreq-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO leave_request
                    (id, login_id, employee_id, leave_type_id, start_date, end_date, days_requested, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, id, loginId, employeeId, req.leaveTypeId(),
                Date.valueOf(req.startDate()), Date.valueOf(req.endDate()),
                req.daysRequested(), req.reason());
        return getRequest(id, loginId);
    }

    public LeaveRequestResponse actionRequest(String requestId, LeaveActionRequest req, String loginId) {
        String action = req.action().toUpperCase();
        if (!action.equals("APPROVED") && !action.equals("REJECTED")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "action must be APPROVED or REJECTED");
        }
        Map<String, Object> existing = requireRequestOwned(requestId, loginId);
        if (!"PENDING".equals(existing.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Request is no longer pending");
        }
        jdbc.update("""
                UPDATE leave_request
                SET status = ?, approver_comment = ?, actioned_at = now(), updated_at = now()
                WHERE id = ? AND login_id = ?
                """, action, req.comment(), requestId, loginId);
        return getRequest(requestId, loginId);
    }

    public void cancelRequest(String requestId, String loginId) {
        Map<String, Object> existing = requireRequestOwned(requestId, loginId);
        if (!"PENDING".equals(existing.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only pending requests can be cancelled");
        }
        jdbc.update("""
                UPDATE leave_request
                SET status = 'CANCELLED', updated_at = now()
                WHERE id = ? AND login_id = ?
                """, requestId, loginId);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private LeaveRequestResponse getRequest(String id, String loginId) {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT lr.id, lr.employee_id, e.first_name, e.last_name,
                       lr.leave_type_id, lt.name AS type_name, lt.color,
                       lr.start_date, lr.end_date, lr.days_requested, lr.reason,
                       lr.status, lr.approver_comment, lr.actioned_at, lr.created_at
                FROM leave_request lr
                JOIN employees e  ON e.id  = lr.employee_id
                JOIN leave_type lt ON lt.id = lr.leave_type_id
                WHERE lr.id = ? AND lr.login_id = ?
                """, id, loginId);
        return mapRequest(row);
    }

    private LeaveRequestResponse mapRequest(Map<String, Object> row) {
        Date sd = (Date) row.get("start_date");
        Date ed = (Date) row.get("end_date");
        Timestamp actionedAt = (Timestamp) row.get("actioned_at");
        Timestamp createdAt  = (Timestamp) row.get("created_at");
        return new LeaveRequestResponse(
                (String) row.get("id"),
                (String) row.get("employee_id"),
                (String) row.get("first_name"),
                (String) row.get("last_name"),
                (String) row.get("leave_type_id"),
                (String) row.get("type_name"),
                (String) row.get("color"),
                sd != null ? sd.toLocalDate() : null,
                ed != null ? ed.toLocalDate() : null,
                toBigDecimal(row.get("days_requested")),
                (String) row.get("reason"),
                (String) row.get("status"),
                (String) row.get("approver_comment"),
                actionedAt != null ? actionedAt.toInstant() : null,
                createdAt  != null ? createdAt.toInstant()  : null
        );
    }

    private Map<String, Object> requireRequestOwned(String requestId, String loginId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, status FROM leave_request WHERE id = ? AND login_id = ? AND is_active = true",
                requestId, loginId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave request not found: " + requestId);
        return rows.get(0);
    }

    private BigDecimal toBigDecimal(Object val) {
        if (val == null) return BigDecimal.ZERO;
        if (val instanceof BigDecimal bd) return bd;
        if (val instanceof Number n)   return new BigDecimal(n.toString());
        return BigDecimal.ZERO;
    }
}
