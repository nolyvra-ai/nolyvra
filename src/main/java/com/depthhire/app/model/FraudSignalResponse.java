package com.depthhire.app.model;

import java.util.List;

public record FraudSignalResponse(
    String candidateId,
    int authenticityScore,          // 0-100
    String overallVerdict,          // "Low Risk" | "Proceed with Caution" | "High Risk"
    List<Signal> signals
) {
    public record Signal(
        String type,        // AI_GENERATED | TIMELINE_INCONSISTENCY | SKILL_MISMATCH | CAREER_PATTERN
        String severity,    // Low | Medium | High
        String title,
        String description
    ) {}
}
