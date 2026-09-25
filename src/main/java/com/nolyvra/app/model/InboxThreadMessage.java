package com.nolyvra.app.model;

import java.time.Instant;
import java.util.List;

public record InboxThreadMessage(
    String id,
    String provider,
    String fromName,
    String fromAddress,
    List<String> toAddresses,
    String subject,
    String bodyHtml,
    String bodyText,
    Instant occurredAt,
    boolean outbound,
    boolean unread
) {}
