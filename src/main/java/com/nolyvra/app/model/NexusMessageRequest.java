package com.nolyvra.app.model;

// POST /api/v1/messaging/threads request — see docs/nexus-integration/shared-contracts.md
public record NexusMessageRequest(
    String candidateId,
    String recruiterRef,
    String tenantRef,
    String body
) {}
