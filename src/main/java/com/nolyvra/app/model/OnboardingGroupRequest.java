package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record OnboardingGroupRequest(
        @NotBlank String name,
        int sequence
) {}
