package com.nolyvra.app.model;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TimesheetDayEntry(
        @NotNull LocalDate workDate,
        @NotNull @DecimalMin("0") @DecimalMax("24") BigDecimal hours,
        String note
) {}
