package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record LeaveRequestResponse(
        String id,
        String employeeId,
        String employeeFirstName,
        String employeeLastName,
        String leaveTypeId,
        String leaveTypeName,
        String leaveTypeColor,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal daysRequested,
        String reason,
        String status,
        String approverComment,
        Instant actionedAt,
        Instant createdAt
) {}
