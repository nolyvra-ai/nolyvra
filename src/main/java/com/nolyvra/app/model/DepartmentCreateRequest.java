package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record DepartmentCreateRequest(
        @NotBlank String name
) {}
