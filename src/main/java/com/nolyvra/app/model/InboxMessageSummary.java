package com.nolyvra.app.model;

import java.time.Instant;

public record InboxMessageSummary(
    String id,
    String threadId,
    String provider,
    String fromName,
    String fromAddress,
    String subject,
    String snippet,
    Instant occurredAt,
    boolean unread
) {}
