package com.nolyvra.app.model;

import java.math.BigDecimal;
import java.util.List;

// POST /api/v1/search/candidates request — see docs/nexus-integration/shared-contracts.md
// Note: no recruiterRef field — the contract's search endpoint doesn't take one, only tenantRef.
public record NexusSearchRequest(
    String jdText,
    List<String> skills,
    String minVerificationTier,
    String location,
    BigDecimal remunerationBudget,
    String employerType,
    String tenantRef,
    Integer page,
    Integer pageSize
) {}
