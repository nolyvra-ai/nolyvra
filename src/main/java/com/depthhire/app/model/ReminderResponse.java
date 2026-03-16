package com.depthhire.app.model;

import java.time.Instant;

public record ReminderResponse(
    Long id,
    String loginId,
    String candidateId,
    String candidateName,   // joined from candidates table, may be null
    String title,
    String description,
    String reminderType,    // MANUAL | AUTO_ANALYSIS_PENDING | AUTO_SCREENING_STUCK | AUTO_INTERVIEW_UPCOMING | AUTO_FOLLOWUP_PENDING
    String priority,        // Low | Normal | High
    Instant dueAt,
    boolean isCompleted,
    Instant completedAt,
    Instant createdAt
) {}
