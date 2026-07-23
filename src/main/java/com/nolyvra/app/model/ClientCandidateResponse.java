package com.nolyvra.app.model;

import java.time.Instant;

public record ClientCandidateResponse(
        String id,
        String name,
        String email,
        String stage,
        String jobTitle,
        Instant createdAt
) {}
