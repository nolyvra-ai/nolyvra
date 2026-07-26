package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

// POST /api/talent-search/nexus-blend request
public record NexusBlendedSearchRequest(
    @NotBlank String query,
    String location,
    String minVerificationTier,
    BigDecimal remunerationBudget,
    String employerType,
    Integer page,
    Integer pageSize
) {}
