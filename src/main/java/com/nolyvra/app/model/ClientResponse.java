package com.nolyvra.app.model;

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
    String linkedinUrl,
    String notes,
    String lastFundingEvent,
    String lastFundingAmount,
    Instant createdAt,
    int    activeJobCount,
    int    filledJobCount,
    int    totalJobCount,
    List<JobSummary> recentJobs
) {
    public record JobSummary(String title, int daysOld, String status) {}
}
