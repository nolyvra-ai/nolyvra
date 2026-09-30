package com.nolyvra.app.model;

import java.util.List;

public record InboxThreadResponse(
    String threadId,
    String provider,
    String subject,
    List<InboxThreadMessage> messages
) {}
