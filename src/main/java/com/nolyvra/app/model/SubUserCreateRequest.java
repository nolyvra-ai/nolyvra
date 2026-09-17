package com.nolyvra.app.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record SubUserCreateRequest(
    @NotBlank String firstName,
    @NotBlank String lastName,
    @NotBlank @Email String email,
    String company,
    String phone
) {}
