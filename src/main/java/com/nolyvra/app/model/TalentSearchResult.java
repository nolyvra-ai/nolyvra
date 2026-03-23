package com.nolyvra.app.model;

import java.util.List;

public record TalentSearchResult(
    String candidateId,         // null if from CoreSignal (external)
    String name,
    String currentTitle,
    String currentCompany,
    String linkedinUrl,
    List<String> matchedSkills,
    List<String> gapSkills,
    int matchScore,             // 0-100 AI-computed
    int yearsExperience,
    String source,              // INTERNAL | CORESIGNAL
    boolean alreadyInPipeline
) {}
