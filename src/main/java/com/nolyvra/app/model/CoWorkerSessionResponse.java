package com.nolyvra.app.model;

import java.time.Instant;

public record CoWorkerSessionResponse(
        Long id,
        String title,
        String preview,
        Instant createdAt,
        Instant lastMessageAt
) {}
