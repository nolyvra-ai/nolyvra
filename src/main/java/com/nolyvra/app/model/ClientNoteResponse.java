package com.nolyvra.app.model;

import java.time.Instant;

public record ClientNoteResponse(
    long    id,
    String  note,
    Instant createdAt
) {}
