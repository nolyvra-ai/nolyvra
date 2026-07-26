package com.nolyvra.app.model;

import java.time.Instant;

// POST /api/v1/messaging/threads response (201) — see docs/nexus-integration/shared-contracts.md
public record NexusThreadResponse(
    String id,
    String sender,
    String body,
    Instant sentAt
) {}
