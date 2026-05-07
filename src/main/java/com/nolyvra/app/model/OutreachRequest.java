package com.nolyvra.app.model;

public record OutreachRequest(
    String clientId,
    String clientName,
    String contactName,
    String industry,
    String recentSignals
) {}
