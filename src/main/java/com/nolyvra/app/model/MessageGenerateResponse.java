package com.nolyvra.app.model;

public record MessageGenerateResponse(
    String subject,
    String body,
    String messageType
) {}
