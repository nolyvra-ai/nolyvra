package com.nolyvra.app.model;

import java.time.Instant;
import java.util.List;

// Recruiter-facing view of an interview_session row. Never carries the raw
// token or its hash — the link itself only ever goes out via the invitation
// email, never back to the recruiter UI.
public record InterviewSessionResponse(
        String id,
        String candidateId,
        String jobApplicationId,
        String status,
        List<InterviewQuestionAnswer> questionsSnapshot,
        Instant tokenExpiresAt,
        Instant consentAt,
        Instant createdAt,
        Instant completedAt
) {}
