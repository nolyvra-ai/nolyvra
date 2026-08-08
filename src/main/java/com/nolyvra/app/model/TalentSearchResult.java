package com.nolyvra.app.model;

import java.util.List;

public record TalentSearchResult(
    String candidateId,         // null if from CoreSignal (external)
    String name,
    String currentTitle,
    String currentCompany,
    String linkedinUrl,
    String email,               // null for CoreSignal (not exposed by API)
    String phone,               // null for CoreSignal; populated from DB for INTERNAL
    List<String> matchedSkills,
    List<String> gapSkills,
    int matchScore,             // 0-100 AI-computed
    int yearsExperience,
    String source,              // INTERNAL | CORESIGNAL
    boolean alreadyInPipeline,
    String coresignalId,        // set for CORESIGNAL results (Bright Data string id); null for INTERNAL
    String avatarUrl,
    Boolean defaultAvatar,
    Long coreSignalApiId        // set for CORESIGNAL results sourced from the real CoreSignal API
                                 // (distinct from coresignalId/Bright Data); null otherwise
) {}
