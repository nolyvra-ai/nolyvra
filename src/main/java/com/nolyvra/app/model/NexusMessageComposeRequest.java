package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

// POST /api/talent-search/nexus-blend/message request — our own API shape.
// Deliberately not NexusMessageRequest (Nexus's own wire shape, which also carries
// recruiterRef/tenantRef) — those come from loginId server-side, the frontend only
// ever needs to supply who and what.
public record NexusMessageComposeRequest(
    @NotBlank String nexusCandidateId,
    @NotBlank String body
) {}
