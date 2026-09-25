package com.nolyvra.app.model;

public record TemplateSuggestion(
    Long templateId,
    String name,
    String subject,
    int confidence,   // 0-100
    String reason
) {}
