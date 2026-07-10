package com.nolyvra.app.model;

import java.util.List;

public record CoreSignalProfileResponse(
    String  coresignalId,       // Bright Data record id — string slug, not numeric
    String  fullName,
    String  jobTitle,
    String  currentCompany,
    String  locationCity,
    String  locationCountry,
    String  linkedinUrl,
    Integer yearsExperience,
    String  managementLevel,
    String  description,
    List<String> skills,
    String  avatarUrl,
    Boolean defaultAvatar,
    String  rawJson             // full raw_json from cache; frontend parses experience/education/etc.
) {}
