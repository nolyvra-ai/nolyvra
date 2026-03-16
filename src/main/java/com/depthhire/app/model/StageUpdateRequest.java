package com.depthhire.app.model;

import jakarta.validation.constraints.NotBlank;

public record StageUpdateRequest(
    @NotBlank String stage,   // Screening | Interview | Assessment | Offer | Selected | Rejected
    String recruiterNotes     // optional notes saved at the same time
) {}
