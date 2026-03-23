package com.nolyvra.app.model;

import java.time.LocalDate;

public record PlanUsageResponse(
        String planId,
        String planName,
        int maxJobs,
        int maxCandidates,
        int currentJobs,
        int currentCandidates,
        int maxTokens,
        int tokensRemaining,
        LocalDate renewDate
) {}