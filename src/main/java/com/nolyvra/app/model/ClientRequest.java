package com.nolyvra.app.model;

public record ClientRequest(
    String companyName,
    String industry,
    String companySize,
    String location,
    String contactPerson,
    String contactEmail,
    String contactTitle,
    String linkedinUrl,
    String notes
) {}
