package com.depthhire.app.model;

import java.time.Instant;

public record CoWorkerTaskResponse(
        Long id,
        String taskType,
        String description,
        String status,       // pending | running | done | failed
        int progress,        // 0-100
        Instant createdAt,
        Instant completedAt
) {}
