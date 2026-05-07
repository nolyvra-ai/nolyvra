package com.nolyvra.app.model;

import java.util.List;

public record PotentialClientResponse(
    String companyName,
    String industry,
    String size,
    String location,
    String hiringSignal,
    List<String> signalReasons,
    int openRoles,
    int matchScore,
    int growthPct,
    List<DecisionMaker> decisionMakers
) {
    public record DecisionMaker(String name, String title) {}
}
