package com.nolyvra.app.model;

import java.time.Instant;

public record SubUserResponse(
    String id,
    String name,
    String email,
    String company,
    String phone,
    boolean verified,
    Instant createdAt
) {}
