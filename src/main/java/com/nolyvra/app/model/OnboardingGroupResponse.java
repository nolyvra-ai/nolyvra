package com.nolyvra.app.model;

import java.util.List;

public record OnboardingGroupResponse(
        String id,
        String templateId,
        String name,
        int sequence,
        List<OnboardingTaskTemplateResponse> tasks
) {}
