package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record TimesheetActionRequest(
        @NotBlank String action,   // APPROVED or REJECTED
        String comment
) {}
