package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;

public record ContactUpdateRequest(
        @NotBlank String name,
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
        String instagramUrl
) {}
