package com.nolyvra.app.model;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SalaryReviewCreateRequest(
        @NotNull @Positive BigDecimal proposedSalary,
        LocalDate effectiveFrom,
        String notes
) {}
