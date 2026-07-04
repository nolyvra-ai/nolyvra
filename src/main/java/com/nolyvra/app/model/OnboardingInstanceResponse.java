package com.nolyvra.app.model;

import java.time.Instant;
import java.util.List;

public record OnboardingInstanceResponse(
        String id,
        String loginId,
        String employeeId,
        String templateId,
        String status,
        double overallProgressPct,
        int overdueCount,
        List<OnboardingGroupProgress> groupProgress,
        List<OnboardingTaskResponse> tasks,
        Instant startedAt,
        Instant completedAt
) {}
