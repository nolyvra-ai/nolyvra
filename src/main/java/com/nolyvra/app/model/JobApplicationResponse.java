package com.nolyvra.app.model;

import java.time.Instant;

public record JobApplicationResponse(
        String id,
        String candidateId,
        String jobId,
        String jobTitle,
        String jobCompany,
        String jobStatus,
        String stage,
        String interviewQuestions,
        Instant createdAt
) {}
