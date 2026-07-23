package com.nolyvra.app.model;

import java.time.Instant;

public record CandidateFileResponse(
        Long id,
        String fileName,
        String contentType,
        long sizeBytes,
        Instant uploadedAt
) {}
