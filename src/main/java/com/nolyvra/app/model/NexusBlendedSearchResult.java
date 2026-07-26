package com.nolyvra.app.model;

import java.util.List;

// A single blended AI Talent Search result — deliberately separate from the
// existing TalentSearchResult (INTERNAL/CORESIGNAL only); this carries Nexus's
// credibility fields too, and marks provenance across all three sources.
public record NexusBlendedSearchResult(
    String candidateId,          // our own ATS candidateId — set for ATS/BOTH; null for NEXUS-only
    String nexusCandidateId,     // Nexus's own candidateId — set for NEXUS/BOTH; null for ATS-only.
                                  // This is the id required by the messaging/consent APIs (per contract).
    String name,
    String currentTitle,
    String currentCompany,       // null for NEXUS-only — Nexus doesn't expose this
    String linkedinUrl,          // NEXUS-only: from Nexus's own result (v0.8). null only if Nexus has none on file.
    String email,                // NEXUS-only: from Nexus's own result (v0.8, Sayan-directed reversal —
                                  // see docs/nexus-integration/shared-contracts.md). Previously always null.
    String phone,                // ALWAYS null unless source is ATS/BOTH — never crosses for Nexus-only
                                  // candidates. Unaffected by the v0.8 email reversal; still fully gated
                                  // behind the consent + phone-reveal flow, never cached.
    List<String> matchedSkills,
    List<String> gapSkills,
    int matchScore,
    int yearsExperience,
    String avatarUrl,
    Boolean defaultAvatar,        // null for NEXUS-only (no equivalent field in Nexus's contract)
    String source,                // INTERNAL | CORESIGNAL | NEXUS | BOTH — the INTERNAL/CORESIGNAL
                                   // split is preserved from TalentSearchResult (not collapsed to a
                                   // generic "ATS") so existing per-source UI treatment still works.
    boolean alreadyInPipeline,
    String location,              // from Nexus's result; null for ATS-only (TalentSearchResult has no location field)
    String identityToken,         // null for ATS-only (Nexus never returned a match)
    Integer credibilityScore,
    String tier,
    List<NexusSearchResponse.TopSkill> topSkills,
    List<String> employerPreferences,
    NexusSearchResponse.PipelineActivity pipelineActivity,
    String nexusProfileUrl
) {}
