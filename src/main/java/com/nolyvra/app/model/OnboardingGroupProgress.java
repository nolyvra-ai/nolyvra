package com.nolyvra.app.model;

public record OnboardingGroupProgress(
        String groupName,
        int groupSequence,
        int totalRequired,
        int completedCount,
        double progressPct
) {}
