package com.depthhire.app.model;

public record MessageGenerateResponse(
    String subject,
    String body,
    String messageType
) {}
