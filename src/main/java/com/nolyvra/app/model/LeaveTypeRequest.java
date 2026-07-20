package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record LeaveTypeRequest(
        @NotBlank String name,
        int defaultDaysPerYear,
        boolean isPaid,
        String color,
        boolean isUnlimited
) {}
