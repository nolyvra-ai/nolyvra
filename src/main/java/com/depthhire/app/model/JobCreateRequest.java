package com.depthhire.app.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record JobCreateRequest(
    @NotBlank String title,
    @NotBlank String seniority,
    @NotBlank String jdText,
    @NotNull List<String> stackTags
) {}
