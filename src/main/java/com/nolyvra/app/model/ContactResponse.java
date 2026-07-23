package com.nolyvra.app.model;

import java.time.Instant;

public record ContactResponse(
        Long id,
        Long clientId,
        String clientCompanyName,
        String clientStatus,
        String clientIndustry,
        String clientLocation,
        String name,
        String title,
        String email,
        String phone,
        String linkedinUrl,
        String facebookUrl,
        String twitterUrl,
        Instant createdAt,
        String candidateId
) {}
