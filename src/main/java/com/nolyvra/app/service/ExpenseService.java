package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ExpenseService {

    private static final Set<String> VALID_STEPS = Set.of(
            "finance_reviewed", "approved", "payment_made", "closed"
    );

    private final JdbcTemplate jdbc;

    public ExpenseService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── List ─────────────────────────────────────────────────────────────────

    public List<ExpenseSubmissionResponse> listByEmployee(String employeeId, String loginId) {
        return jdbc.queryForList(
                BASE_SQL + " WHERE es.login_id = ? AND es.employee_id = ? AND es.is_active = true" +
                " ORDER BY es.created_at DESC", loginId, employeeId)
                .stream().map(this::map).toList();
    }

    public List<ExpenseSubmissionResponse> listAll(String loginId, String status) {
        var sql = new StringBuilder(BASE_SQL + " WHERE es.login_id = ? AND es.is_active = true");
        var p   = new java.util.ArrayList<Object>();
        p.add(loginId);
        if (status != null && !status.isBlank()) { sql.append(" AND es.status = ?"); p.add(status); }
        sql.append(" ORDER BY es.created_at DESC");
        return jdbc.queryForList(sql.toString(), p.toArray()).stream().map(this::map).toList();
    }

    // ─── Create (multipart) ───────────────────────────────────────────────────

    public ExpenseSubmissionResponse create(String employeeId, ExpenseSubmissionCreateRequest req,
                                             MultipartFile receipt, String loginId) {
        String id = "exp-" + UUID.randomUUID();
        byte[] data    = null;
        String rName   = null;
        if (receipt != null && !receipt.isEmpty()) {
            try { data = receipt.getBytes(); rName = receipt.getOriginalFilename(); }
            catch (IOException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read receipt file"); }
        }
        jdbc.update("""
                INSERT INTO expense_submission
                  (id, login_id, employee_id, title, amount, category, expense_date, receipt_name, receipt_data, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id, loginId, employeeId,
                req.title(),
                req.amount(),
                req.category(),
                Date.valueOf(req.expenseDate() != null ? req.expenseDate() : LocalDate.now()),
                rName, data,
                req.notes());
        return getById(id, loginId);
    }

    // ─── Update step ──────────────────────────────────────────────────────────

    public ExpenseSubmissionResponse updateStep(String id, WorkflowStepRequest req, String loginId) {
        if (!VALID_STEPS.contains(req.step()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid step: " + req.step());
        requireOwned(id, loginId, "IN_PROGRESS");
        String col = "step_" + req.step();
        jdbc.update("UPDATE expense_submission SET " + col + " = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                req.checked(), id, loginId);
        return getById(id, loginId);
    }

    // ─── Approve (all 4 steps must be done) ──────────────────────────────────

    public ExpenseSubmissionResponse approve(String id, String loginId) {
        ExpenseSubmissionResponse es = requireOwned(id, loginId, "IN_PROGRESS");
        if (!es.stepFinanceReviewed() || !es.stepApproved() || !es.stepPaymentMade() || !es.stepClosed())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "All checklist steps must be completed before approving");
        jdbc.update("UPDATE expense_submission SET status = 'APPROVED', updated_at = now() WHERE id = ? AND login_id = ?",
                id, loginId);
        return getById(id, loginId);
    }

    // ─── Reject / Cancel ──────────────────────────────────────────────────────

    public ExpenseSubmissionResponse reject(String id, String loginId) {
        requireOwned(id, loginId, "IN_PROGRESS");
        jdbc.update("UPDATE expense_submission SET status = 'REJECTED', updated_at = now() WHERE id = ? AND login_id = ?",
                id, loginId);
        return getById(id, loginId);
    }

    public void cancel(String id, String loginId) {
        requireOwned(id, loginId, "IN_PROGRESS");
        jdbc.update("UPDATE expense_submission SET status = 'CANCELLED', updated_at = now(), is_active = false WHERE id = ? AND login_id = ?",
                id, loginId);
    }

    // ─── Monthly summary ──────────────────────────────────────────────────────

    public MonthlyExpenseSummaryResponse getMonthlySummary(String loginId, String month) {
        String monthStart = month + "-01";

        BigDecimal salaryTotal = jdbc.queryForObject(
                "SELECT COALESCE(SUM(salary / 12.0), 0) FROM employees " +
                "WHERE login_id = ? AND is_active = true AND status = 'ACTIVE' AND salary IS NOT NULL",
                BigDecimal.class, loginId);

        int employeeCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM employees " +
                "WHERE login_id = ? AND is_active = true AND status = 'ACTIVE' AND salary IS NOT NULL",
                Integer.class, loginId);

        BigDecimal expenseTotal = jdbc.queryForObject(
                "SELECT COALESCE(SUM(amount), 0) FROM expense_submission " +
                "WHERE login_id = ? AND is_active = true AND status IN ('IN_PROGRESS', 'APPROVED') " +
                "AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', ?::DATE)",
                BigDecimal.class, loginId, monthStart);

        int expenseCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM expense_submission " +
                "WHERE login_id = ? AND is_active = true AND status IN ('IN_PROGRESS', 'APPROVED') " +
                "AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', ?::DATE)",
                Integer.class, loginId, monthStart);

        List<MonthlyExpenseSummaryResponse.CategoryBreakdown> byCategory = jdbc.queryForList(
                "SELECT COALESCE(category, 'Uncategorised') AS cat, SUM(amount) AS total, COUNT(*) AS cnt " +
                "FROM expense_submission " +
                "WHERE login_id = ? AND is_active = true AND status IN ('IN_PROGRESS', 'APPROVED') " +
                "AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', ?::DATE) " +
                "GROUP BY category ORDER BY total DESC",
                loginId, monthStart)
                .stream()
                .map(row -> new MonthlyExpenseSummaryResponse.CategoryBreakdown(
                        (String) row.get("cat"),
                        toBD(row.get("total")),
                        ((Number) row.get("cnt")).intValue()))
                .toList();

        BigDecimal grandTotal = (salaryTotal != null ? salaryTotal : BigDecimal.ZERO)
                .add(expenseTotal != null ? expenseTotal : BigDecimal.ZERO);

        return new MonthlyExpenseSummaryResponse(month, salaryTotal, employeeCount,
                expenseTotal, expenseCount, grandTotal, byCategory);
    }

    // ─── Receipt download ─────────────────────────────────────────────────────

    public Map<String, Object> getReceiptRaw(String id, String loginId) {
        var rows = jdbc.queryForList(
                "SELECT receipt_name, receipt_data FROM expense_submission WHERE id = ? AND login_id = ?",
                id, loginId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Expense not found");
        return rows.get(0);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static final String BASE_SQL = """
            SELECT es.id, es.login_id, es.employee_id, e.first_name, e.last_name,
                   es.title, es.amount, es.category, es.expense_date,
                   es.receipt_name, es.notes, es.status,
                   es.step_finance_reviewed, es.step_approved, es.step_payment_made, es.step_closed,
                   es.created_at, es.updated_at
            FROM expense_submission es
            JOIN employees e ON e.id = es.employee_id
            """;

    private ExpenseSubmissionResponse getById(String id, String loginId) {
        return jdbc.queryForList(BASE_SQL + " WHERE es.id = ? AND es.login_id = ?", id, loginId)
                .stream().map(this::map).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Expense not found: " + id));
    }

    private ExpenseSubmissionResponse requireOwned(String id, String loginId, String requiredStatus) {
        ExpenseSubmissionResponse es = getById(id, loginId);
        if (!es.status().equals(requiredStatus))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Expense is not in " + requiredStatus + " status");
        return es;
    }

    private ExpenseSubmissionResponse map(Map<String, Object> row) {
        Date     expDate = (Date)      row.get("expense_date");
        Timestamp cre   = (Timestamp) row.get("created_at");
        Timestamp upd   = (Timestamp) row.get("updated_at");
        return new ExpenseSubmissionResponse(
                (String)  row.get("id"),
                (String)  row.get("login_id"),
                (String)  row.get("employee_id"),
                (String)  row.get("first_name"),
                (String)  row.get("last_name"),
                (String)  row.get("title"),
                toBD(row.get("amount")),
                (String)  row.get("category"),
                expDate != null ? expDate.toLocalDate() : null,
                (String)  row.get("receipt_name"),
                (String)  row.get("notes"),
                (String)  row.get("status"),
                Boolean.TRUE.equals(row.get("step_finance_reviewed")),
                Boolean.TRUE.equals(row.get("step_approved")),
                Boolean.TRUE.equals(row.get("step_payment_made")),
                Boolean.TRUE.equals(row.get("step_closed")),
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
