package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.LocalDate;

public record EmployeeUpdateRequest(
        String firstName,
        String lastName,
        String email,
        String phone,
        String jobTitle,
        EmploymentType employmentType,
        String status,
        String managerId,
        String departmentId,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal salary
) {}
