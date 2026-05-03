package com.nolyvra.app.model;

import java.util.List;

public record AnalysisJobBulkRequest(
        List<String> candidateIds
) {}

