package com.nolyvra.app.service;

import com.nolyvra.app.model.CrmDashboardSummaryResponse;
import com.nolyvra.app.model.CrmDashboardSummaryResponse.DeptHeadcount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
public class CrmDashboardService {

    private final JdbcTemplate jdbc;

    public CrmDashboardService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public CrmDashboardSummaryResponse getSummary(String loginId) {

        // ── Employees ─────────────────────────────────────────────────────────
        int totalEmployees      = count("SELECT COUNT(*) FROM employees WHERE login_id = ? AND is_active = true", loginId);
        int activeEmployees     = count("SELECT COUNT(*) FROM employees WHERE login_id = ? AND is_active = true AND status = 'ACTIVE'", loginId);
        int onboardingEmployees = count("SELECT COUNT(*) FROM employees WHERE login_id = ? AND is_active = true AND status = 'ONBOARDING'", loginId);
        int inactiveEmployees   = count("SELECT COUNT(*) FROM employees WHERE login_id = ? AND is_active = true AND status = 'INACTIVE'", loginId);

        // ── Onboarding instances ──────────────────────────────────────────────
        int onboardingInProgress  = count("SELECT COUNT(*) FROM onboarding_instance WHERE login_id = ? AND status = 'IN_PROGRESS'", loginId);
        int onboardingCompleted   = count("SELECT COUNT(*) FROM onboarding_instance WHERE login_id = ? AND status = 'COMPLETED'", loginId);
        int onboardingNotStarted  = count("SELECT COUNT(*) FROM onboarding_instance WHERE login_id = ? AND status = 'NOT_STARTED'", loginId);

        // ── Leave ──────────────────────────────────────────────────────────────
        int leavePending          = count("SELECT COUNT(*) FROM leave_request WHERE login_id = ? AND is_active = true AND status = 'PENDING'", loginId);
        int leaveApprovedMonth    = count("SELECT COUNT(*) FROM leave_request WHERE login_id = ? AND is_active = true AND status = 'APPROVED' AND DATE_TRUNC('month', actioned_at) = DATE_TRUNC('month', now())", loginId);
        int leaveActiveToday      = count("SELECT COUNT(*) FROM leave_request WHERE login_id = ? AND is_active = true AND status = 'APPROVED' AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE", loginId);

        // ── Promotions ────────────────────────────────────────────────────────
        int promotionsInProgress  = count("SELECT COUNT(*) FROM promotion_request WHERE login_id = ? AND is_active = true AND status = 'IN_PROGRESS'", loginId);
        int promotionsApproved    = count("SELECT COUNT(*) FROM promotion_request WHERE login_id = ? AND status = 'APPROVED' AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', now())", loginId);

        // ── Salary reviews ────────────────────────────────────────────────────
        int salaryInProgress      = count("SELECT COUNT(*) FROM salary_review WHERE login_id = ? AND is_active = true AND status = 'IN_PROGRESS'", loginId);
        int salaryApproved        = count("SELECT COUNT(*) FROM salary_review WHERE login_id = ? AND status = 'APPROVED' AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', now())", loginId);

        // ── Expenses ──────────────────────────────────────────────────────────
        int expensesInProgress    = count("SELECT COUNT(*) FROM expense_submission WHERE login_id = ? AND is_active = true AND status = 'IN_PROGRESS'", loginId);
        int expensesApproved      = count("SELECT COUNT(*) FROM expense_submission WHERE login_id = ? AND status = 'APPROVED' AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', now())", loginId);
        BigDecimal pendingAmount  = jdbc.queryForObject(
                "SELECT COALESCE(SUM(amount), 0) FROM expense_submission WHERE login_id = ? AND is_active = true AND status = 'IN_PROGRESS'",
                BigDecimal.class, loginId);

        // ── Grievances ────────────────────────────────────────────────────────
        int grievancesInProgress  = count("SELECT COUNT(*) FROM grievance WHERE login_id = ? AND is_active = true AND status = 'IN_PROGRESS'", loginId);
        int grievancesResolved    = count("SELECT COUNT(*) FROM grievance WHERE login_id = ? AND status = 'RESOLVED' AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', now())", loginId);

        // ── Disciplinary ──────────────────────────────────────────────────────
        int disciplinaryInProgress = count("SELECT COUNT(*) FROM disciplinary_action WHERE login_id = ? AND is_active = true AND status = 'IN_PROGRESS'", loginId);
        int disciplinaryClosed     = count("SELECT COUNT(*) FROM disciplinary_action WHERE login_id = ? AND status = 'CLOSED' AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', now())", loginId);

        // ── Department headcount ───────────────────────────────────────────────
        List<DeptHeadcount> byDept = jdbc.queryForList("""
                SELECT COALESCE(d.name, 'Unassigned') AS dept_name, COUNT(e.id) AS cnt
                FROM employees e
                LEFT JOIN departments d ON d.id = e.department_id
                WHERE e.login_id = ? AND e.is_active = true AND e.status = 'ACTIVE'
                GROUP BY d.name
                ORDER BY cnt DESC
                LIMIT 8
                """, loginId)
                .stream()
                .map(row -> new DeptHeadcount(
                        (String) row.get("dept_name"),
                        ((Number) row.get("cnt")).intValue()))
                .toList();

        return new CrmDashboardSummaryResponse(
                totalEmployees, activeEmployees, onboardingEmployees, inactiveEmployees,
                onboardingInProgress, onboardingCompleted, onboardingNotStarted,
                leavePending, leaveApprovedMonth, leaveActiveToday,
                promotionsInProgress, promotionsApproved,
                salaryInProgress, salaryApproved,
                expensesInProgress, expensesApproved, pendingAmount,
                grievancesInProgress, grievancesResolved,
                disciplinaryInProgress, disciplinaryClosed,
                byDept
        );
    }

    private int count(String sql, Object... args) {
        Integer result = jdbc.queryForObject(sql, Integer.class, args);
        return result != null ? result : 0;
    }
}
