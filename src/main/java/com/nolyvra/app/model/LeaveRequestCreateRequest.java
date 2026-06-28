package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record LeaveRequestCreateRequest(
        @NotBlank String leaveTypeId,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        @NotNull @Positive BigDecimal daysRequested,
        String reason
) {}
