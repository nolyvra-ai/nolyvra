package com.nolyvra.app.model;

import java.util.List;
import java.util.Map;

public record CandidateImportPreviewResponse(
        List<String>            rawHeaders,
        Map<String, String>     suggestedMapping,
        List<Map<String,String>> previewRows,
        int                     totalRows,
        String                  importToken
) {}
