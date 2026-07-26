package com.nolyvra.app.model;

import java.util.List;

// POST /api/v1/search/candidates response — see docs/nexus-integration/shared-contracts.md
public record NexusSearchResponse(
    List<Result> results,
    String scoreBreakdownRef
) {

    public record Result(
        String candidateId,
        String identityToken,
        String displayName,
        String title,
        String location,
        Integer matchScore,
        Integer credibilityScore,
        String tier,
        List<TopSkill> topSkills,
        List<String> employerPreferences,
        Boolean employerPreferenceMatch,
        String remunerationFlag,
        PipelineActivity pipelineActivity,
        String nexusProfileUrl,
        // v0.8 (2026-07-26, Sayan-directed reversal — see docs/nexus-integration/shared-contracts.md):
        // avatarUrl, linkedinUrl and email are now included for every search result.
        // Phone is NOT part of this — it remains fully gated behind consent + phone-reveal.
        String avatarUrl,
        String linkedinUrl,
        String email
    ) {}

    public record TopSkill(
        String skill,
        Integer score,
        String tier
    ) {}

    public record PipelineActivity(
        Integer pipelines,
        Integer interviewing,
        Integer shortlisted
    ) {}
}
