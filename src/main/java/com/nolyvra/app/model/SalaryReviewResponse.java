package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record SalaryReviewResponse(
        String id,
        String loginId,
        String employeeId,
        String employeeFirstName,
        String employeeLastName,
        BigDecimal currentSalary,
        BigDecimal proposedSalary,
        LocalDate effectiveFrom,
        String notes,
        String status,
        boolean stepSalaryReviewed,
        boolean stepManagerProposed,
        boolean stepFinanceApproved,
        boolean stepHrApproved,
        Instant createdAt,
        Instant updatedAt
) {}
