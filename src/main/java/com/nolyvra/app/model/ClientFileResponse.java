package com.nolyvra.app.model;

import java.time.Instant;

public record ClientFileResponse(
        Long id,
        String fileName,
        String contentType,
        long sizeBytes,
        Instant uploadedAt
) {}
