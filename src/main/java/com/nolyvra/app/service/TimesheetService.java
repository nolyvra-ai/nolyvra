package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class TimesheetService {

    private final JdbcTemplate jdbc;

    public TimesheetService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── Submit ───────────────────────────────────────────────────────────────

    @Transactional
    public TimesheetResponse submitTimesheet(String employeeId, TimesheetCreateRequest req, String loginId) {
        for (TimesheetDayEntry day : req.days()) {
            if (day.workDate().isBefore(req.weekStartDate()) || day.workDate().isAfter(req.weekStartDate().plusDays(6))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Day " + day.workDate() + " is outside the week starting " + req.weekStartDate());
            }
        }

        BigDecimal totalHours = req.days().stream()
                .map(TimesheetDayEntry::hours)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        String id = "ts-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO timesheet (id, login_id, employee_id, week_start_date, total_hours)
                VALUES (?, ?, ?, ?, ?)
                """, id, loginId, employeeId, Date.valueOf(req.weekStartDate()), totalHours);

        for (TimesheetDayEntry day : req.days()) {
            jdbc.update("""
                    INSERT INTO timesheet_day (id, timesheet_id, work_date, hours, note)
                    VALUES (?, ?, ?, ?, ?)
                    """, "tsd-" + UUID.randomUUID(), id, Date.valueOf(day.workDate()), day.hours(), day.note());
        }

        return getRequest(id, loginId);
    }

    // ─── List ─────────────────────────────────────────────────────────────────

    public List<TimesheetResponse> listAll(String loginId, String status, String employeeId) {
        StringBuilder sql = new StringBuilder("""
                SELECT t.id, t.employee_id, e.first_name, e.last_name,
                       t.week_start_date, t.total_hours, t.status,
                       t.approver_comment, t.actioned_at, t.created_at, t.updated_at
                FROM timesheet t
                JOIN employees e ON e.id = t.employee_id
                WHERE t.login_id = ?
                """);
        List<Object> params = new ArrayList<>();
        params.add(loginId);
        if (status != null && !status.isBlank()) { sql.append(" AND t.status = ?"); params.add(status); }
        if (employeeId != null && !employeeId.isBlank()) { sql.append(" AND t.employee_id = ?"); params.add(employeeId); }
        sql.append(" ORDER BY t.week_start_date DESC");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), params.toArray());
        List<TimesheetResponse> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(mapTimesheet(row, loadDays((String) row.get("id"))));
        }
        return result;
    }

    // ─── Get by id ────────────────────────────────────────────────────────────

    private TimesheetResponse getRequest(String id, String loginId) {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT t.id, t.employee_id, e.first_name, e.last_name,
                       t.week_start_date, t.total_hours, t.status,
                       t.approver_comment, t.actioned_at, t.created_at, t.updated_at
                FROM timesheet t
                JOIN employees e ON e.id = t.employee_id
                WHERE t.id = ? AND t.login_id = ?
                """, id, loginId);
        return mapTimesheet(row, loadDays(id));
    }

    private List<TimesheetDayEntry> loadDays(String timesheetId) {
        return jdbc.query("""
                SELECT work_date, hours, note FROM timesheet_day
                WHERE timesheet_id = ? ORDER BY work_date
                """,
                (rs, r) -> new TimesheetDayEntry(
                        rs.getDate("work_date").toLocalDate(),
                        rs.getBigDecimal("hours"),
                        rs.getString("note")),
                timesheetId);
    }

    private TimesheetResponse mapTimesheet(Map<String, Object> row, List<TimesheetDayEntry> days) {
        Date weekStart = (Date) row.get("week_start_date");
        Timestamp actionedAt = (Timestamp) row.get("actioned_at");
        Timestamp createdAt  = (Timestamp) row.get("created_at");
        Timestamp updatedAt  = (Timestamp) row.get("updated_at");
        return new TimesheetResponse(
                (String) row.get("id"),
                null,
                (String) row.get("employee_id"),
                (String) row.get("first_name"),
                (String) row.get("last_name"),
                weekStart != null ? weekStart.toLocalDate() : null,
                (BigDecimal) row.get("total_hours"),
                (String) row.get("status"),
                (String) row.get("approver_comment"),
                actionedAt != null ? actionedAt.toInstant() : null,
                createdAt  != null ? createdAt.toInstant()  : null,
                updatedAt  != null ? updatedAt.toInstant()  : null,
                days
        );
    }

    // ─── Approve / Reject ────────────────────────────────────────────────────

    public TimesheetResponse actionRequest(String id, TimesheetActionRequest req, String loginId) {
        String action = req.action().toUpperCase();
        if (!action.equals("APPROVED") && !action.equals("REJECTED")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "action must be APPROVED or REJECTED");
        }
        Map<String, Object> existing = requireOwned(id, loginId);
        if (!"PENDING".equals(existing.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Timesheet is no longer pending");
        }
        jdbc.update("""
                UPDATE timesheet
                SET status = ?, approver_comment = ?, actioned_at = now(), updated_at = now()
                WHERE id = ? AND login_id = ?
                """, action, req.comment(), id, loginId);
        return getRequest(id, loginId);
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────

    public void cancelRequest(String id, String loginId) {
        cancelRequest(id, loginId, null);
    }

    // requireEmployeeId: when non-null (employee self-service calls), the
    // timesheet must belong to that employee — otherwise a 404.
    public void cancelRequest(String id, String loginId, String requireEmployeeId) {
        Map<String, Object> existing = requireOwned(id, loginId);
        if (requireEmployeeId != null && !requireEmployeeId.equals(existing.get("employee_id"))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found: " + id);
        }
        if (!"PENDING".equals(existing.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only pending timesheets can be cancelled");
        }
        jdbc.update("""
                UPDATE timesheet SET status = 'CANCELLED', updated_at = now()
                WHERE id = ? AND login_id = ?
                """, id, loginId);
    }

    private Map<String, Object> requireOwned(String id, String loginId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, status, employee_id FROM timesheet WHERE id = ? AND login_id = ?",
                id, loginId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found: " + id);
        return rows.get(0);
    }

    // ─── Analytics ────────────────────────────────────────────────────────────
    // Approved hours only — "hours clocked" means confirmed, not pending/rejected.

    public TimesheetAnalyticsResponse getAnalytics(String loginId) {
        List<EmployeeHoursSummary> byEmployee = jdbc.query("""
                SELECT e.id AS employee_id, e.first_name, e.last_name,
                       COALESCE(SUM(td.hours) FILTER (
                           WHERE td.work_date >= date_trunc('week', current_date)::date
                             AND td.work_date <  date_trunc('week', current_date)::date + 7
                       ), 0) AS week_hours,
                       COALESCE(SUM(td.hours) FILTER (
                           WHERE td.work_date >= date_trunc('month', current_date)::date
                             AND td.work_date <  (date_trunc('month', current_date) + interval '1 month')::date
                       ), 0) AS month_hours,
                       COALESCE(SUM(td.hours) FILTER (
                           WHERE td.work_date >= date_trunc('year', current_date)::date
                             AND td.work_date <  (date_trunc('year', current_date) + interval '1 year')::date
                       ), 0) AS year_hours
                FROM employees e
                LEFT JOIN timesheet t     ON t.employee_id = e.id AND t.login_id = e.login_id AND t.status = 'APPROVED'
                LEFT JOIN timesheet_day td ON td.timesheet_id = t.id
                WHERE e.login_id = ? AND e.is_active = true
                GROUP BY e.id, e.first_name, e.last_name
                ORDER BY e.last_name, e.first_name
                """,
                (rs, r) -> new EmployeeHoursSummary(
                        rs.getString("employee_id"),
                        rs.getString("first_name"),
                        rs.getString("last_name"),
                        rs.getBigDecimal("week_hours"),
                        rs.getBigDecimal("month_hours"),
                        rs.getBigDecimal("year_hours")),
                loginId);

        BigDecimal totalWeek  = byEmployee.stream().map(EmployeeHoursSummary::hoursThisWeek).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalMonth = byEmployee.stream().map(EmployeeHoursSummary::hoursThisMonth).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalYear  = byEmployee.stream().map(EmployeeHoursSummary::hoursThisYear).reduce(BigDecimal.ZERO, BigDecimal::add);

        return new TimesheetAnalyticsResponse(totalWeek, totalMonth, totalYear, byEmployee);
    }

    // ─── Excel export ─────────────────────────────────────────────────────────
    // Tenant-only (see TimesheetController) — one summary row per submitted
    // week plus a detail sheet with every individual day entry.

    public byte[] exportToExcel(String loginId, String status, String employeeId) {
        List<TimesheetResponse> timesheets = listAll(loginId, status, employeeId);

        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(headerFont);

            Sheet summary = workbook.createSheet("Timesheets");
            String[] summaryHeaders = {
                    "Employee", "Week Start", "Week End", "Total Hours",
                    "Status", "Approver Comment", "Actioned At"
            };
            writeHeaderRow(summary, headerStyle, summaryHeaders);

            Sheet detail = workbook.createSheet("Daily Entries");
            String[] detailHeaders = { "Employee", "Date", "Hours", "Note" };
            writeHeaderRow(detail, headerStyle, detailHeaders);

            int summaryRowNum = 1;
            int detailRowNum = 1;
            for (TimesheetResponse ts : timesheets) {
                String employeeName = ts.employeeFirstName() + " " + ts.employeeLastName();

                Row row = summary.createRow(summaryRowNum++);
                row.createCell(0).setCellValue(employeeName);
                row.createCell(1).setCellValue(ts.weekStartDate() != null ? ts.weekStartDate().toString() : "");
                row.createCell(2).setCellValue(ts.weekStartDate() != null ? ts.weekStartDate().plusDays(6).toString() : "");
                row.createCell(3).setCellValue(ts.totalHours() != null ? ts.totalHours().doubleValue() : 0);
                row.createCell(4).setCellValue(ts.status());
                row.createCell(5).setCellValue(ts.approverComment() != null ? ts.approverComment() : "");
                row.createCell(6).setCellValue(ts.actionedAt() != null ? ts.actionedAt().toString() : "");

                for (TimesheetDayEntry day : ts.days()) {
                    Row dRow = detail.createRow(detailRowNum++);
                    dRow.createCell(0).setCellValue(employeeName);
                    dRow.createCell(1).setCellValue(day.workDate().toString());
                    dRow.createCell(2).setCellValue(day.hours() != null ? day.hours().doubleValue() : 0);
                    dRow.createCell(3).setCellValue(day.note() != null ? day.note() : "");
                }
            }

            for (int i = 0; i < summaryHeaders.length; i++) summary.autoSizeColumn(i);
            for (int i = 0; i < detailHeaders.length; i++) detail.autoSizeColumn(i);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        } catch (java.io.IOException e) {
            throw new UncheckedIOException("Failed to generate timesheet export", e);
        }
    }

    private void writeHeaderRow(Sheet sheet, CellStyle headerStyle, String[] headers) {
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
    }
}
