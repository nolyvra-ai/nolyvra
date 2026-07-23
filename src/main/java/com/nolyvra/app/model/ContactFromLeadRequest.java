package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record ContactFromLeadRequest(
        @NotBlank String companyName,
        String industry,
        String location,
        String linkedinUrl,
        @NotBlank String name,
        String title
) {}
