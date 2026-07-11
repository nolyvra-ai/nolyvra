package com.nolyvra.app.model;

import java.time.Instant;

public record HubSpotConnection(
        Long id,
        String loginId,
        String hubspotPortalId,
        String hubspotPortalName,
        String hubspotUserEmail,
        String accessToken,
        String refreshToken,
        Instant expiresAt
) {}
