package com.nolyvra.app.model;

import java.time.Instant;
import java.util.List;

// Public GET /api/public/interview/{token} — everything the candidate's
// intro/interview screen needs, and nothing more (no ids, no internal
// status beyond what's needed to resume a reload mid-interview).
// consentAt lets the frontend recompute the true remaining countdown after a
// page reload (elapsed = now - consentAt) instead of resetting the timer.
public record InterviewIntroResponse(
        String candidateFirstName,
        String jobTitle,
        String companyName,
        String status,
        int sessionTimeoutMinutes,
        Instant consentAt,
        List<InterviewQuestionAnswer> questions
) {}
