package com.nolyvra.app.model;

import java.time.Instant;
import java.util.List;

public record DisciplinaryActionResponse(
        String id,
        String loginId,
        String employeeId,
        String firstName,
        String lastName,
        String title,
        String incidentDescription,
        String incidentReportName,
        String hrDecisionName,
        String notes,
        String status,
        boolean stepInvestigated,
        boolean stepManagerReviewed,
        boolean stepHrDecided,
        List<CorrectiveActionItemResponse> correctiveActions,
        Instant createdAt,
        Instant updatedAt
) {}
