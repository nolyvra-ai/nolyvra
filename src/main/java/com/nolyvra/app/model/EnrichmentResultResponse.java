package com.nolyvra.app.model;

public record EnrichmentResultResponse(
    String jobId,
    String status,     // PENDING, or whatever terminal value MatchKraft returns once the job finishes
    String email,       // null until found
    String candidateId
) {}
