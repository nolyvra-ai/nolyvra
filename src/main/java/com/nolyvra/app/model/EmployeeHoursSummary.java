package com.nolyvra.app.model;

import java.math.BigDecimal;

public record EmployeeHoursSummary(
        String employeeId,
        String firstName,
        String lastName,
        BigDecimal hoursThisWeek,
        BigDecimal hoursThisMonth,
        BigDecimal hoursThisYear
) {}
