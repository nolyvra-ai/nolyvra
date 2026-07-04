package com.nolyvra.app.model;

import java.time.LocalDate;

public record OnboardingTaskUpdateRequest(
        String status,
        String assigneeUserId,
        LocalDate dueDate
) {}
