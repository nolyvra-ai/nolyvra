package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record TimesheetResponse(
        String id,
        String loginId,
        String employeeId,
        String employeeFirstName,
        String employeeLastName,
        LocalDate weekStartDate,
        BigDecimal totalHours,
        String status,
        String approverComment,
        Instant actionedAt,
        Instant createdAt,
        Instant updatedAt,
        List<TimesheetDayEntry> days
) {}
