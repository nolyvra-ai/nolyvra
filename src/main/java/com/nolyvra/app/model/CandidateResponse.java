package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record CandidateResponse(
    String id,
    String jobId,
    String name,
    String email,
    String phone,
    String linkedinUrl,
    Instant createdAt,
    String stage,
    String cvText,
    List<String> skills,
    String currentTitle,
    String location,
    String state,
    BigDecimal yearsExperience,
    String seniorityLevel,
    BigDecimal expectedSalaryMin,
    BigDecimal expectedSalaryMax,
    String salaryCurrency,
    Integer noticePeriodWeeks,
    String workRights,
    Boolean remoteFlexible
) {}
