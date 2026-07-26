package com.nolyvra.app.model;

import java.util.List;

// POST /api/talent-search/nexus-blend response
public record NexusBlendedSearchResponse(
    String query,
    int totalFound,
    List<NexusBlendedSearchResult> results
) {}
