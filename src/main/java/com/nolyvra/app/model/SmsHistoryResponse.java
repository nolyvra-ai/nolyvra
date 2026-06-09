package com.nolyvra.app.model;

import java.time.Instant;

public record SmsHistoryResponse(
    Long id,
    String candidateId,
    String toNumber,
    String body,
    String templateType,
    String provider,
    String status,
    String providerMessageId,
    String errorMessage,
    Instant sentAt
) {}
