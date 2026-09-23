package com.nolyvra.app.model;

// GET /api/candidates/{candidateId}/analysis/fit-preview — short, unpersisted
// AI blurb shown in the candidate row's quick-preview popup before a full
// analysis has been run.
public record FitPreviewResponse(String summary) {
}
