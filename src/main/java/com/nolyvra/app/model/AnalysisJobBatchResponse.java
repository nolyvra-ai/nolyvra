package com.nolyvra.app.model;

public record AnalysisJobBatchResponse(
        String batchId,
        int queued,
        int running,
        int succeeded,
        int failed,
        int skipped,
        int total
) {}

