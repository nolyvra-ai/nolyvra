package com.nolyvra.app.model;

public record CandidateImportResultResponse(
        int importedCount,
        int duplicateCount,
        int invalidCount,
        int totalRows
) {}
