package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ClientResponse(
    long   id,
    String loginId,
    String companyName,
    String industry,
    String companySize,
    String location,
    String contactPerson,
    String contactEmail,
    String contactTitle,
    String contactPhone,
    String linkedinUrl,
    String facebookUrl,
    String twitterUrl,
    String website,
    String aboutCompany,
    String fullAddress,
    String locality,
    String state,
    String country,
    String zip,
    List<ClientContact> secondaryContacts,
    String latestNote,
    String lastFundingEvent,
    String lastFundingAmount,
    Instant createdAt,
    int    activeJobCount,
    int    filledJobCount,
    int    totalJobCount,
    List<JobSummary> recentJobs,
    List<FeeTotal> totalFee,
    String status
) {
    // Sum of estimated fees from Active/Fulfilling jobs only — broken out per currency,
    // since fees in different currencies cannot be meaningfully added together.
    public record FeeTotal(String currency, BigDecimal amount) {}

    public record JobSummary(
        String title, int daysOld, String status,
        BigDecimal salary, String currency, BigDecimal feePercentage,
        String feeType, BigDecimal fixedFee, BigDecimal estimatedFee) {}
}
