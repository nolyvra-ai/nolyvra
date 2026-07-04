package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ExpenseSubmissionResponse(
        String id,
        String loginId,
        String employeeId,
        String firstName,
        String lastName,
        String title,
        BigDecimal amount,
        String category,
        LocalDate expenseDate,
        String receiptName,
        String notes,
        String status,
        boolean stepFinanceReviewed,
        boolean stepApproved,
        boolean stepPaymentMade,
        boolean stepClosed,
        Instant createdAt,
        Instant updatedAt
) {}
