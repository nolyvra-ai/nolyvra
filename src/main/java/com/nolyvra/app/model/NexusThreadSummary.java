package com.nolyvra.app.model;

import java.time.Instant;

// GET /api/v1/messaging/threads?recruiterRef= response element (v0.6, displayName
// added post-sprint 2026-07-26 — see docs/nexus-integration/shared-contracts.md)
public record NexusThreadSummary(
    String id,
    String candidateId,
    Instant createdAt,
    String displayName // nullable — sourced from Candidate.getFullName() on Nexus's side
) {}
