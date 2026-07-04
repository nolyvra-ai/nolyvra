package com.nolyvra.app.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record EmployeeCreateRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank @Email String email,
        String phone,
        String jobTitle,
        @NotNull EmploymentType employmentType,
        String status,
        String managerId,
        String departmentId,
        LocalDate startDate,
        LocalDate endDate
) {}
