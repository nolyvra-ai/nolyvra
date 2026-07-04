package com.nolyvra.app.model;

import java.time.Instant;
import java.time.LocalDate;

public record OnboardingTaskResponse(
        String id,
        String instanceId,
        String groupName,
        int groupSequence,
        String name,
        int sequence,
        String ownerRole,
        String assigneeUserId,
        LocalDate dueDate,
        boolean isRequired,
        String status,
        boolean isOverdue,
        Instant completedAt
) {}
