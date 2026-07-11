package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record ExternalLoadMoreRequest(
    @NotBlank String query     // original natural-language search query, re-run for filter extraction
) {}
