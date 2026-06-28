package com.nolyvra.app.model;

import java.time.Instant;

public record GrievanceResponse(
        String id,
        String loginId,
        String employeeId,
        String firstName,
        String lastName,
        String title,
        String description,
        String complaintName,
        String resolutionNotes,
        String status,
        boolean stepInvestigated,
        boolean stepHrReviewed,
        boolean stepResolved,
        boolean stepClosed,
        Instant createdAt,
        Instant updatedAt
) {}
