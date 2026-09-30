package com.nolyvra.app.model;

public record EnrichmentStartResponse(
    String jobId,
    String status,
    String candidateId
) {}
