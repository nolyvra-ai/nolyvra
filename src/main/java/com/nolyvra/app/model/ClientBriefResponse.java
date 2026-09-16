package com.nolyvra.app.model;

import java.util.List;

public record ClientBriefResponse(
    String seniorityLevel,        // e.g. "Senior · 5+ yrs"
    String roleType,              // e.g. "Technical Lead"
    String industry,              // e.g. "FinTech"
    String jobTitle,               // e.g. "Senior Backend Engineer", extracted or inferred from brief
    String employmentType,        // "Full-time" | "Contract" | "Part-time"
    String company,               // extracted from brief if mentioned, else ""
    String location,              // extracted from brief if mentioned, else ""
    String generatedJdText,       // full generated JD text
    List<String> extractedSkills,
    List<String> softSkills
) {}