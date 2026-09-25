package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record TemplateSuggestionRequest(
    @NotBlank String messageBody
) {}
