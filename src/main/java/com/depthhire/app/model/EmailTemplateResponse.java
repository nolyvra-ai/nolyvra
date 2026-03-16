package com.depthhire.app.model;

import java.time.Instant;

public record EmailTemplateResponse(
    Long id,
    String templateType,
    String name,
    String subject,
    String body,
    boolean isDefault,
    Instant createdAt
) {}
