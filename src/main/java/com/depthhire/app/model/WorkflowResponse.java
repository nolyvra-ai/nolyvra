package com.depthhire.app.model;

import java.time.Instant;
import java.util.List;

public record WorkflowResponse(
    String candidateId,
    String candidateName,
    String email,
    String linkedinUrl,
    String jobId,
    String jobTitle,
    String company,
    String stage,
    String recruiterNotes,
    Integer consistencyScore,
    Integer capabilityScore,
    String riskLevel,
    Instant createdAt,
    List<ActivityEvent> activityTimeline
) {
    public record ActivityEvent(
        Long id,
        String eventType,
        String description,
        String note,
        Instant createdAt
    ) {}
}
