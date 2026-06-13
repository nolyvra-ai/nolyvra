package com.nolyvra.app.model;

import java.time.Instant;

public record CandidateListItemResponse(
    String id,
    String jobId,
    String jobTitle,
    String jobCompany,
    String name,
    String email,
    String linkedinUrl,
    Instant createdAt,
    String stage,
    Integer consistencyScore,
    Integer capabilityScore,
    String riskLevel,
    Integer timelineMatchPercent,
    String status
) {}
