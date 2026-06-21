package com.nolyvra.app.model;

import java.math.BigDecimal;

public record BillablePlacementResponse(
        String jobId,
        String title,
        String currency,
        BigDecimal salary,
        BigDecimal feePercentage,
        BigDecimal estimatedFee
) {}
