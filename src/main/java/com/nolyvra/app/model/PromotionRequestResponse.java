package com.nolyvra.app.model;

import java.time.Instant;
import java.time.LocalDate;

public record PromotionRequestResponse(
        String id,
        String loginId,
        String employeeId,
        String employeeFirstName,
        String employeeLastName,
        String currentRole,
        String proposedRole,
        LocalDate promotionEffective,
        String notes,
        String status,
        boolean stepRecommendationReviewed,
        boolean stepPerformanceValidated,
        boolean stepLeadershipApproved,
        boolean stepCompensationReviewed,
        Instant createdAt,
        Instant updatedAt
) {}
