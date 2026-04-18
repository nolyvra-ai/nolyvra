package com.nolyvra.app.model;

import java.time.Instant;

public record OAuthToken(
        Long id,
        String loginId,
        String provider,
        String accessToken,
        String refreshToken,
        Instant expiresAt,
        String email
) {}
