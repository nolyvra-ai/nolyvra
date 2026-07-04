package com.nolyvra.app.model;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record SetLeaveBalanceRequest(
        @NotNull BigDecimal allocatedDays,
        int year
) {}
