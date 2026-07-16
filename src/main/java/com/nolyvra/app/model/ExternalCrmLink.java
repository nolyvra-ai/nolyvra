package com.nolyvra.app.model;

import java.time.Instant;

public record ExternalCrmLink(
        Long id,
        String loginId,
        String provider,
        String localType,
        String localId,
        String externalId,
        String externalUrl,
        Instant lastSyncedAt,
        String lastSyncStatus,
        String lastSyncError
) {}
