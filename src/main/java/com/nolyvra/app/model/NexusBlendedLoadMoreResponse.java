package com.nolyvra.app.model;

import java.util.List;

// POST /api/talent-search/nexus-blend/load-more response
public record NexusBlendedLoadMoreResponse(
    List<NexusBlendedSearchResult> results
) {}
