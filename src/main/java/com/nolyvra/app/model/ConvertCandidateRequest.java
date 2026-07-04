package com.nolyvra.app.model;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record ConvertCandidateRequest(
        String jobTitle,
        @NotNull EmploymentType employmentType,
        LocalDate startDate,
        String managerId,
        String departmentId
) {}
