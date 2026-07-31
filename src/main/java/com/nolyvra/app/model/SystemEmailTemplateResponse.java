package com.nolyvra.app.model;

import java.time.OffsetDateTime;
import java.util.List;

public record SystemEmailTemplateResponse(
        String key,
        String name,
        String subject,
        String htmlBody,
        String textBody,
        boolean enabled,
        long version,
        OffsetDateTime updatedAt,
        boolean customized,
        List<String> supportedVariables,
        List<String> requiredVariables) {
}
