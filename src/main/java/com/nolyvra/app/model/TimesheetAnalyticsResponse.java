package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.util.List;

public record TimesheetAnalyticsResponse(
        BigDecimal totalHoursThisWeek,
        BigDecimal totalHoursThisMonth,
        BigDecimal totalHoursThisYear,
        List<EmployeeHoursSummary> byEmployee
) {}
