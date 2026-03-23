package com.nolyvra.app.model;

import java.util.List;

public record CandidateSummaryResponse(
    String candidateId,
    String professionalSummary,
    List<String> strengths,
    List<String> concerns,
    List<String> interviewFocusAreas
) {}
