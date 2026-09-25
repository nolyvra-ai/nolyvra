package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record ServiceRequestEmailRequest(
    @NotBlank String name,
    @NotBlank String email,
    @NotBlank String comments
) {}
