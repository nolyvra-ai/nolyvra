package com.nolyvra.app.model;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

// Result shape for POST /api/candidates/search (Smart Talent Lens). Carries
// both the rule-based match info and the existing CV-analysis fields
// (consistency/capability/risk/status) so the detail panel needs no second call.
@Builder
public record CandidateSearchResult(
    String candidateId,
    String name,
    String email,
    String phone,
    String linkedinUrl,
    boolean verified,
    String jobId,
    String jobTitle,           // "Job Applied" — the linked job's title, distinct from currentTitle
    String currentTitle,       // the candidate's own current role (candidates.current_title)
    String currentCompany,
    String location,
    String state,
    Double distanceKm,     // distance from the search location, when both could be geocoded; else null
    List<String> skills,
    Instant updatedAt,
    BigDecimal yearsExperience,
    String seniorityLevel,
    BigDecimal expectedSalaryMin,
    BigDecimal expectedSalaryMax,
    String salaryCurrency,
    Integer noticePeriodWeeks,
    String workRights,
    Boolean remoteFlexible,
    List<String> matchedSkills,
    List<String> gapSkills,
    int matchScore,
    String matchTier,
    Integer consistencyScore,
    Integer capabilityScore,
    String riskLevel,
    String status
) {}
