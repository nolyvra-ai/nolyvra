package com.nolyvra.app.model;

import java.time.Instant;

public record LoginResponse(
    String id,
    String name,
    String company,
    String email,
    Instant createdAt
) {}