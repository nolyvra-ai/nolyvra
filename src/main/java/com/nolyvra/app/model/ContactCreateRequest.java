package com.nolyvra.app.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ContactCreateRequest(
        @NotNull Long clientId,
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
