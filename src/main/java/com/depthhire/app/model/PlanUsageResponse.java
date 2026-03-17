package com.depthhire.app.model;

public record PlanUsageResponse(
        String planId,
        String planName,
        int maxJobs,
        int maxCandidates,
        int currentJobs,
        int currentCandidates
) {}
