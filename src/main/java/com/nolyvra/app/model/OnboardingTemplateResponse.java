package com.nolyvra.app.model;

import java.time.Instant;
import java.util.List;

public record OnboardingTemplateResponse(
        String id,
        String loginId,
        String name,
        String employmentType,
        boolean isDefault,
        boolean isActive,
        List<OnboardingGroupResponse> groups,
        Instant createdAt,
        Instant updatedAt
) {}
