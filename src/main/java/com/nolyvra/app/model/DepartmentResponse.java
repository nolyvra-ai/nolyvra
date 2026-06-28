package com.nolyvra.app.model;

import java.time.Instant;

public record DepartmentResponse(
        String id,
        String loginId,
        String name,
        Instant createdAt
) {}
