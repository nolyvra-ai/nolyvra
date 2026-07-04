package com.nolyvra.app.model;

import java.util.List;

public record BulkUploadResult(
        int success,
        int failed,
        int total,
        List<String> errors
) {}
