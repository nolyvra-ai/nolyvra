package com.nolyvra.app.model;

import java.time.Instant;

public record CvTemplateResponse(
    String id,
    String name,
    String fileName,
    Instant createdAt,
    Instant updatedAt
) {}
