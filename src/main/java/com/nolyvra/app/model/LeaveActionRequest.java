package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record LeaveActionRequest(
        @NotBlank String action,   // APPROVED or REJECTED
        String comment
) {}
