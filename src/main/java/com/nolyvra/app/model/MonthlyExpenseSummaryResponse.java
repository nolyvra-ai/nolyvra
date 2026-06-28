package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.util.List;

public record MonthlyExpenseSummaryResponse(
        String month,
        BigDecimal salaryTotal,
        int employeeCount,
        BigDecimal expenseTotal,
        int expenseCount,
        BigDecimal grandTotal,
        List<CategoryBreakdown> byCategory
) {
    public record CategoryBreakdown(String category, BigDecimal amount, int count) {}
}
