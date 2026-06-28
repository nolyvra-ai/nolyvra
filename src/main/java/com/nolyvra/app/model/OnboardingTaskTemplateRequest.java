package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record OnboardingTaskTemplateRequest(
        @NotBlank String name,
        int sequence,
        String ownerRole,
        Integer dueOffsetDays,
        boolean isRequired
) {}
