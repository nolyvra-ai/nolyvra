package com.nolyvra.app.model;

public record DisciplinaryActionCreateRequest(
        String title,
        String incidentDescription,
        String notes
) {}
