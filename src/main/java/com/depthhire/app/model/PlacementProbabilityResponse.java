package com.depthhire.app.model;

import java.util.List;

public record PlacementProbabilityResponse(
    String candidateId,
    int placementProbability,           // 0-100
    String confidenceLevel,             // Low | Medium | High
    int basedOnSimilarPlacements,
    List<String> positiveSignals,
    List<String> riskFactors
) {}
