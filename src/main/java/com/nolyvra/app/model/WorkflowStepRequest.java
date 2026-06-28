package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record WorkflowStepRequest(
        @NotBlank String step,
        boolean checked
) {}
