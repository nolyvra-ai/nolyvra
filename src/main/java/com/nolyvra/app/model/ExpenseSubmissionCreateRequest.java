package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseSubmissionCreateRequest(
        String title,
        BigDecimal amount,
        String category,
        LocalDate expenseDate,
        String notes
) {}
