package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

// POST /api/talent-search/nexus-blend/consent-request and .../phone-reveal request —
// identical shape for both, our own API's request shape (mirrors NexusMessageComposeRequest).
public record NexusConsentActionRequest(
    @NotBlank String nexusCandidateId
) {}
