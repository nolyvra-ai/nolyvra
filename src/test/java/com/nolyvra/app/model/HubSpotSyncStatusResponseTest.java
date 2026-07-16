package com.nolyvra.app.model;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class HubSpotSyncStatusResponseTest {

    @Test
    void failedUpdateRetainsLinkedStateAndExternalUrl() {
        Instant syncedAt = Instant.parse("2026-07-12T01:00:00Z");
        ExternalCrmLink link = new ExternalCrmLink(
                1L, "local@nolyvra.test", "hubspot", "client", "42",
                "company-123", "https://app.hubspot.com/company/company-123",
                syncedAt, "failed", "HubSpot unavailable");

        HubSpotSyncStatusResponse response = HubSpotSyncStatusResponse.fromLink(link);

        assertThat(response.state()).isEqualTo("sync_failed");
        assertThat(response.linked()).isTrue();
        assertThat(response.externalUrl()).isEqualTo(link.externalUrl());
        assertThat(response.lastSyncedAt()).isEqualTo(syncedAt);
        assertThat(response.lastSyncError()).isEqualTo("HubSpot unavailable");
    }

    @Test
    void exposesDisconnectedAndNotLinkedStates() {
        assertThat(HubSpotSyncStatusResponse.disconnected().state()).isEqualTo("disconnected");
        assertThat(HubSpotSyncStatusResponse.notLinked().state()).isEqualTo("not_linked");
        assertThat(HubSpotSyncStatusResponse.disconnected().linked()).isFalse();
        assertThat(HubSpotSyncStatusResponse.notLinked().linked()).isFalse();
    }
}
