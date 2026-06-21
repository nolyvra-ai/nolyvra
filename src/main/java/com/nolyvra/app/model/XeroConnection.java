package com.nolyvra.app.model;

import java.time.Instant;

public record XeroConnection(
        Long id,
        String loginId,
        String xeroTenantId,
        String xeroTenantName,
        String accessToken,
        String refreshToken,
        Instant expiresAt
) {}
