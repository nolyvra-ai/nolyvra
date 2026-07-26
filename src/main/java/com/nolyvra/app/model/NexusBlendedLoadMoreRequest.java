package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

// POST /api/talent-search/nexus-blend/load-more request
public record NexusBlendedLoadMoreRequest(
    @NotBlank String query,
    Integer nexusPage
) {}
