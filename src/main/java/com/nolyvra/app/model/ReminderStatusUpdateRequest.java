package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record ReminderStatusUpdateRequest(
    @NotBlank String status   // To Do | In Progress | Awaiting Response | Done
) {}
