package com.nolyvra.app.model;

public record LeaveTypeResponse(
        String id,
        String loginId,
        String name,
        int defaultDaysPerYear,
        boolean isPaid,
        String color
) {}
