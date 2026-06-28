package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record OnboardingTemplateCreateRequest(
        @NotBlank String name,
        String employmentType,
        boolean isDefault
) {}
