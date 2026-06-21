package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record JobResponse(
    String id,
    String title,
    String company,
    String jobType,
    String seniority,
    String jdText,
    String location,
    List<String> stackTags,
    Instant createdAt,
    String status,
    BigDecimal salary,
    String currency,
    BigDecimal feePercentage,
    BigDecimal estimatedFee
) {}
