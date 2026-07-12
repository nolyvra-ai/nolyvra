package com.nolyvra.app.model;

import java.time.Instant;

public record HubSpotSyncStatusResponse(
        String state,
        boolean linked,
        String externalUrl,
        Instant lastSyncedAt,
        String lastSyncStatus,
        String lastSyncError
) {
    public static HubSpotSyncStatusResponse disconnected() {
        return new HubSpotSyncStatusResponse(
                "disconnected", false, null, null, null, null);
    }

    public static HubSpotSyncStatusResponse notLinked() {
        return new HubSpotSyncStatusResponse(
                "not_linked", false, null, null, null, null);
    }

    public static HubSpotSyncStatusResponse fromLink(ExternalCrmLink link) {
        boolean linked = link.externalId() != null && !link.externalId().isBlank();
        String state = "failed".equals(link.lastSyncStatus()) ? "sync_failed" : "linked";
        return new HubSpotSyncStatusResponse(
                state,
                linked,
                link.externalUrl(),
                link.lastSyncedAt(),
                link.lastSyncStatus(),
                link.lastSyncError());
    }
}
