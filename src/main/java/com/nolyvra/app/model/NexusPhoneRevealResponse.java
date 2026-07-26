package com.nolyvra.app.model;

// POST /api/v1/consent/phone-reveal response (200) — see docs/nexus-integration/shared-contracts.md
// A 403 (no active grant) is not modeled here — it surfaces as HttpClientErrorException.Forbidden.
public record NexusPhoneRevealResponse(
    String phone
) {}
