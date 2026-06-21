package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;

import java.math.BigDecimal;

// Used by PUT /api/candidates/{id} (Edit Profile). Distinct from CandidateCreateRequest
// because job assignment is settable here only when the candidate is currently
// unassigned — the frontend disables the job field once a candidate has a job.
@Builder
public record CandidateUpdateRequest(

    @NotBlank
    String name,

    String email,

    String phone,

    String linkedinUrl,

    String cvText,

    String jobId,

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
