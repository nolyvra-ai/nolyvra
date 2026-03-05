package com.depthhire.app.model;

import java.time.Instant;

public record AnalysisResponse(

    Long id,
    String candidateId,
    String candidate_name,
    String jobId,

    Instant analyzedAt,

    Integer consistencyScore,
    Integer capabilityScore,
    String riskLevel,
    Integer timelineMatchPercent

) {}