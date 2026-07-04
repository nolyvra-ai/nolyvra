package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.util.List;

public record CrmDashboardSummaryResponse(

        // Employees
        int totalEmployees,
        int activeEmployees,
        int onboardingEmployees,
        int inactiveEmployees,

        // Onboarding workflows
        int onboardingInProgress,
        int onboardingCompleted,
        int onboardingNotStarted,

        // Leave
        int leavePending,
        int leaveApprovedThisMonth,
        int leaveActiveToday,

        // Promotions
        int promotionsInProgress,
        int promotionsApprovedThisMonth,

        // Salary reviews
        int salaryReviewsInProgress,
        int salaryReviewsApprovedThisMonth,

        // Expenses
        int expensesInProgress,
        int expensesApprovedThisMonth,
        BigDecimal expensesPendingAmount,

        // Grievances
        int grievancesInProgress,
        int grievancesResolvedThisMonth,

        // Disciplinary actions
        int disciplinaryInProgress,
        int disciplinaryClosedThisMonth,

        // Department headcount (ACTIVE employees only)
        List<DeptHeadcount> byDepartment

) {
    public record DeptHeadcount(String departmentName, int headcount) {}
}
