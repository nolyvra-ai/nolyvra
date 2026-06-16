package com.nolyvra.app.model;

import java.util.Map;

public record CandidateImportConfirmRequest(
        String              importToken,
        Map<String, String> mapping
) {}
