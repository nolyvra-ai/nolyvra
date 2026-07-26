package com.nolyvra.app.model;

import java.time.Instant;

// POST /api/v1/integration/events request (ATS → Nexus, outbound pipeline events).
// See docs/nexus-integration/shared-contracts.md — payload carries identityToken,
// never raw email.
public record NexusIntegrationEventRequest(
    String eventId,
    String eventType,
    String identityToken,
    String tenantRef,
    String stage,
    Instant occurredAt
) {}
