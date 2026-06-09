package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record SmsSendRequest(
    @NotBlank String toNumber,
    @NotBlank String body,
    String candidateId,
    String templateType
) {}
