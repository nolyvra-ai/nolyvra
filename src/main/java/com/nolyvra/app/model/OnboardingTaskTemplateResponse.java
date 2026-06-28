package com.nolyvra.app.model;

import java.time.Instant;

public record OnboardingTaskTemplateResponse(
        String id,
        String groupId,
        String name,
        int sequence,
        String ownerRole,
        Integer dueOffsetDays,
        boolean isRequired,
        Instant createdAt
) {}
