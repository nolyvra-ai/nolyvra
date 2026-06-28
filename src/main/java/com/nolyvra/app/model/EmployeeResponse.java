package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record EmployeeResponse(
        String id,
        String loginId,
        String candidateId,
        String firstName,
        String lastName,
        String email,
        String phone,
        String jobTitle,
        String employmentType,
        String status,
        String managerId,
        String managerName,
        String departmentId,
        String departmentName,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal salary,
        LocalDate salaryEffectiveFrom,
        LocalDate promotionEffective,
        Instant createdAt,
        Instant updatedAt
) {}
