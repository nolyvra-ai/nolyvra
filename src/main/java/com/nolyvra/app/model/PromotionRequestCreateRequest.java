package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public record PromotionRequestCreateRequest(
        @NotBlank String proposedRole,
        LocalDate promotionEffective,
        String notes
) {}
