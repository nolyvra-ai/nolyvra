package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.util.List;

public record JobCreateRequest(
    @NotBlank String title,
    String company,
    @NotBlank String jobType,     // Remote/Hybrid/Onsite etc
    String seniority,
    @NotBlank String jdText,
    String location,
    List<String> stackTags,
    String jobStatus,
    BigDecimal salary,
    String currency,
    BigDecimal feePercentage
) {}