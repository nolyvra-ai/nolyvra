package com.nolyvra.app.model;

import lombok.Builder;

import java.math.BigDecimal;
import java.util.List;

// Structured filters from the Candidates page filter panel (Role & Skills,
// Location, Experience & Fit, Other Preferences). Scored against internal
// candidates only — no OpenAI call, no token deduction.
@Builder
public record CandidateFilterRequest(
    List<String> skills,
    String jobTitleKeywords,
    String location,
    String state,          // AU state/territory code for the search location, e.g. "VIC" — disambiguates same-named suburbs
    Integer radiusKm,       // proximity radius from `location`/`state`, 5-100km; null = no radius filtering
    BigDecimal minYears,
    BigDecimal maxYears,
    String seniorityLevel,
    BigDecimal salaryMin,
    BigDecimal salaryMax,
    Integer noticePeriodMaxWeeks,
    String workRights,
    Boolean remoteFlexible
) {}
