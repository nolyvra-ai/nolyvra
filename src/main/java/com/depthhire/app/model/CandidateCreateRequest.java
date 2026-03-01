package com.depthhire.app.model;

import jakarta.validation.constraints.NotBlank;

public record CandidateCreateRequest(
    @NotBlank String name,
    String email,
    @NotBlank String linkedinUrl,
    @NotBlank String cvText // MVP v1: CV text only (redacted/disclaimer on UI)
) {}
