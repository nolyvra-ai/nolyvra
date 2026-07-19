package com.nolyvra.app.model;

import java.util.List;

public record ClientRequest(
    String companyName,
    String industry,
    String companySize,
    String location,
    String contactPerson,
    String contactEmail,
    String contactTitle,
    String contactPhone,
    String linkedinUrl,
    List<ClientContact> secondaryContacts,
    String note
) {}
