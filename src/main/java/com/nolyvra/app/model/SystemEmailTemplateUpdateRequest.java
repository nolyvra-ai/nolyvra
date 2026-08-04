package com.nolyvra.app.model;

public record SystemEmailTemplateUpdateRequest(
        String subject,
        String htmlBody,
        String textBody,
        Boolean enabled,
        Long version) {
}
