package com.depthhire.app.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record ReminderCreateRequest(
    @NotBlank String title,
    String description,
    String candidateId,     // optional link to a candidate
    @NotNull Instant dueAt,
    String priority         // Low | Normal | High  (defaults to Normal)
) {}
