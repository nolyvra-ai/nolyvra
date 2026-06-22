package com.nolyvra.app.model;

public record CandidateImportResultResponse(
        int importedCount,
        int updatedCount,
        int duplicateCount,
        int invalidCount,
        int totalRows
) {}
