package com.nolyvra.app.model;

import java.time.Instant;

public record EmailHistoryResponse(
    Long id,
    String candidateId,
    String toAddress,
    String subject,
    String body,
    String templateType,
    String status,
    Instant sentAt,
    Long clientId
) {}
