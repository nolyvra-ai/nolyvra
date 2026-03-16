package com.depthhire.app.model;

import java.time.Instant;

public record InterviewResponse(
    String id,
    String candidateId,
    String candidateName,
    String jobId,
    String jobTitle,
    String company,
    String interviewer,
    String interviewType,
    Instant scheduledAt,
    Integer durationMinutes,
    String location,
    String meetingLink,
    String notes,
    String status,
    Instant createdAt
) {}
