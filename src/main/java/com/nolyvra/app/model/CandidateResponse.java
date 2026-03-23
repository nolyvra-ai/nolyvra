package com.nolyvra.app.model;

import java.time.Instant;

public record CandidateResponse(
    String id,
    String jobId,
    String name,
    String email,
    String linkedinUrl,
    Instant createdAt,
    String stage,
    String cvText
) {}
