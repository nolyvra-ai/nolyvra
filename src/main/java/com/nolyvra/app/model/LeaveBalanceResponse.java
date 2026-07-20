package com.nolyvra.app.model;

import java.math.BigDecimal;

public record LeaveBalanceResponse(
        String id,
        String employeeId,
        String leaveTypeId,
        String leaveTypeName,
        String leaveTypeColor,
        boolean isPaid,
        int year,
        BigDecimal allocatedDays,
        BigDecimal usedDays,
        BigDecimal remainingDays,
        boolean isUnlimited
) {}
