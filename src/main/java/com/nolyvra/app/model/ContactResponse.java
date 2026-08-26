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
        String personalEmail,
        String workEmail,
        String otherEmail,
        String personalPhone,
        String workPhone,
        String mobilePhone,
        String meetupUrl,
        String githubUrl,
        String instagramUrl,
        Instant createdAt,
        String candidateId
) {}
