package com.nolyvra.app.model;

// Shared request shape for both POST /api/v1/consent/requests and
// POST /api/v1/consent/phone-reveal — see docs/nexus-integration/shared-contracts.md
public record NexusConsentRequest(
    String candidateId,
    String recruiterRef,
    String tenantRef
) {}
