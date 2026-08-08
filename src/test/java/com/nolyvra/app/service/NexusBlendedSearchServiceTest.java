package com.nolyvra.app.service;

import com.nolyvra.app.model.NexusBlendedSearchRequest;
import com.nolyvra.app.model.NexusBlendedSearchResult;
import com.nolyvra.app.model.NexusSearchRequest;
import com.nolyvra.app.model.NexusSearchResponse;
import com.nolyvra.app.model.TalentSearchRequest;
import com.nolyvra.app.model.TalentSearchResponse;
import com.nolyvra.app.model.TalentSearchResult;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class NexusBlendedSearchServiceTest {

    private static final String LOGIN_ID = "login-1";

    private final TalentSearchService talentSearchService = mock(TalentSearchService.class);
    private final NexusClient nexusClient = mock(NexusClient.class);
    private final IdentityTokenService identityTokenService = mock(IdentityTokenService.class);
    private final NexusBlendedSearchService service =
            new NexusBlendedSearchService(talentSearchService, nexusClient, identityTokenService);

    @Test
    void mergesInternalCandidateAndMatchingNexusResultIntoOneBothResult() {
        TalentSearchResult internal = internalResult("c1", "alice@example.com", 70);
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(talentSearchResponse(internal));
        when(identityTokenService.compute("alice@example.com")).thenReturn("tok-alice");
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters(anyString())).thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Java"), null));
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenReturn(new NexusSearchResponse(List.of(nexusResult("tok-alice", 90)), null));

        NexusBlendedSearchResult result = service.search(blendedRequest(), LOGIN_ID).results().get(0);

        assertThat(result.source()).isEqualTo("BOTH");
        assertThat(result.candidateId()).isEqualTo("c1");
        assertThat(result.email()).isEqualTo("alice@example.com");
        assertThat(result.phone()).isEqualTo("+61 400 000 000");
        assertThat(result.credibilityScore()).isEqualTo(90);
        assertThat(result.identityToken()).isEqualTo("tok-alice");
    }

    @Test
    void internalCandidateWithNoNexusMatchStaysSourceAts() {
        TalentSearchResult internal = internalResult("c2", "bob@example.com", 55);
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(talentSearchResponse(internal));
        when(identityTokenService.compute("bob@example.com")).thenReturn("tok-bob");
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters(anyString())).thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Java"), null));
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenReturn(new NexusSearchResponse(List.of(nexusResult("tok-someone-else", 80)), null));

        NexusBlendedSearchResult result = onlyResultWithCandidateId(service.search(blendedRequest(), LOGIN_ID), "c2");

        assertThat(result.source()).isEqualTo("INTERNAL");
        assertThat(result.matchScore()).isEqualTo(55);
        assertThat(result.email()).isEqualTo("bob@example.com");
        assertThat(result.credibilityScore()).isNull();
    }

    @Test
    void coresignalResultWithNoEmailCanNeverBeDedupedIntoABothMerge() {
        TalentSearchResult coresignal = coresignalResult(65);
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(talentSearchResponse(coresignal));
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters(anyString())).thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Java"), null));
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenReturn(new NexusSearchResponse(List.of(), null));

        NexusBlendedSearchResult result = service.search(blendedRequest(), LOGIN_ID).results().get(0);

        assertThat(result.source()).isEqualTo("CORESIGNAL");
        // No email was ever available to hash, so identityTokenService must never be
        // invoked for this candidate — dedup is structurally impossible, not just unlikely.
        verify(identityTokenService, never()).compute(anyString());
    }

    @Test
    void nexusOnlyResultStillNeverExposesPhone() {
        // Phone stays gated regardless of source — see nexusOnlyResultNowExposesEmailAvatarAndLinkedinUrl
        // below for the v0.8 fields that DID stop being gated. Phone is unaffected: it's
        // only ever surfaced via the separate consent + phone-reveal flow, never cached.
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(new TalentSearchResponse("query", 0, 0, 0, List.of()));
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters(anyString())).thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Java"), null));
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenReturn(new NexusSearchResponse(List.of(nexusResult("tok-nexus-only", 88)), null));

        NexusBlendedSearchResult result = service.search(blendedRequest(), LOGIN_ID).results().get(0);

        assertThat(result.source()).isEqualTo("NEXUS");
        assertThat(result.phone()).isNull();
    }

    @Test
    void nexusOnlyResultNowExposesEmailAvatarAndLinkedinUrl() {
        // v0.8 (2026-07-26, Sayan-directed reversal — see docs/nexus-integration/shared-contracts.md):
        // Nexus's search response now includes avatarUrl, linkedinUrl and email for every
        // result. This is a deliberate reversal of the original non-negotiable, scoped to
        // exactly these three fields — phone remains gated (see the test above).
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(new TalentSearchResponse("query", 0, 0, 0, List.of()));
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters(anyString())).thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Java"), null));
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenReturn(new NexusSearchResponse(List.of(nexusResult("tok-nexus-only", 88)), null));

        NexusBlendedSearchResult result = service.search(blendedRequest(), LOGIN_ID).results().get(0);

        assertThat(result.source()).isEqualTo("NEXUS");
        assertThat(result.email()).isEqualTo("nexus-name@example.com");
        assertThat(result.avatarUrl()).isEqualTo("https://nexus.nolyvra.com/avatars/nexus-candidate-1");
        assertThat(result.linkedinUrl()).isEqualTo("https://linkedin.com/in/nexus-name");
    }

    @Test
    void nexusClientThrowingDegradesToAtsOnlyResultsWithoutPropagating() {
        TalentSearchResult internal = internalResult("c3", "carol@example.com", 60);
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(talentSearchResponse(internal));
        when(identityTokenService.compute("carol@example.com")).thenReturn("tok-carol");
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters(anyString())).thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Java"), null));
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenThrow(new RuntimeException("connection timed out"));

        NexusBlendedSearchResult result = service.search(blendedRequest(), LOGIN_ID).results().get(0);

        assertThat(result.source()).isEqualTo("INTERNAL");
        assertThat(result.candidateId()).isEqualTo("c3");
    }

    @Test
    void unconfiguredNexusClientIsNeverCalled() {
        TalentSearchResult internal = internalResult("c4", "dave@example.com", 50);
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(talentSearchResponse(internal));
        when(nexusClient.isConfigured()).thenReturn(false);

        NexusBlendedSearchResult result = service.search(blendedRequest(), LOGIN_ID).results().get(0);

        verify(nexusClient, never()).searchCandidates(any());
        assertThat(result.source()).isEqualTo("INTERNAL");
        // identityTokenService.compute() must never be called when Nexus isn't
        // configured — the real IdentityTokenService throws on an empty secret
        // (SecretKeySpec rejects an empty key), which a Mockito mock would silently
        // swallow by returning null instead, masking exactly this regression.
        verifyNoInteractions(identityTokenService);
    }

    @Test
    void skipsTheNexusCallEntirelyWhenNoSkillsOrKeywordsCanBeExtracted() {
        TalentSearchResult internal = internalResult("c5", "erin@example.com", 50);
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(talentSearchResponse(internal));
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters(anyString())).thenReturn(new TalentSearchService.NexusSearchFilters(List.of(), null));

        NexusBlendedSearchResult result = service.search(blendedRequest(), LOGIN_ID).results().get(0);

        // Nexus requires a non-empty skills list — sending an empty one would just
        // get rejected with a 400, so we shouldn't even try.
        verify(nexusClient, never()).searchCandidates(any());
        assertThat(result.source()).isEqualTo("INTERNAL");
    }

    @Test
    void passesTheExtractedSkillsThroughToTheNexusRequest() {
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(new TalentSearchResponse("query", 0, 0, 0, List.of()));
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters("java engineer")).thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Delivery Lead"), null));
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenReturn(new NexusSearchResponse(List.of(), null));

        service.search(blendedRequest(), LOGIN_ID);

        verify(nexusClient).searchCandidates(argThat(req -> req.skills().equals(List.of("Delivery Lead"))));
    }

    @Test
    void passesTheAiExtractedLocationThroughToTheNexusRequestWhenNoExplicitFilterIsSet() {
        // 2026-07-26 fix: NexusBlendedSearchRequest.location() is never populated by
        // the frontend today, so without this the AI-extracted location (e.g.
        // "Melbourne" from "Java Delivery Lead Melbourne") never reached Nexus at all.
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(new TalentSearchResponse("query", 0, 0, 0, List.of()));
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters("java engineer"))
                .thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Java"), "Melbourne"));
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenReturn(new NexusSearchResponse(List.of(), null));

        service.search(blendedRequest(), LOGIN_ID);

        verify(nexusClient).searchCandidates(argThat(req -> "Melbourne".equals(req.location())));
    }

    @Test
    void explicitLocationFilterOverridesTheAiExtractedOne() {
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(new TalentSearchResponse("query", 0, 0, 0, List.of()));
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters("java engineer"))
                .thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Java"), "Melbourne"));
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenReturn(new NexusSearchResponse(List.of(), null));

        service.search(new NexusBlendedSearchRequest("java engineer", "Sydney", null, null, null, 0, 9), LOGIN_ID);

        verify(nexusClient).searchCandidates(argThat(req -> "Sydney".equals(req.location())));
    }

    @Test
    void nexusResultsUseTierFixedMatchScoreInsteadOfNexusRawMatchScore() {
        // Sayan-confirmed 2026-07-26: the displayed Match Score for a NEXUS/BOTH result
        // is a fixed value per verification tier, not Nexus's own blended matchScore —
        // see NEXUS_TIER_MATCH_SCORE. Covers the low tier (floor), a known non-floor
        // tier, and an unrecognized tier value (falls back to the 85 floor, not 0).
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(new TalentSearchResponse("query", 0, 0, 0, List.of()));
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters(anyString())).thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Java"), null));
        NexusSearchResponse.Result selfDeclared = nexusResultWithTier("nexus-a", "SELF_DECLARED");
        NexusSearchResponse.Result humanEndorsed = nexusResultWithTier("nexus-b", "HUMAN_ENDORSED");
        NexusSearchResponse.Result unknownTier = nexusResultWithTier("nexus-c", "SOMETHING_NEW");
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenReturn(new NexusSearchResponse(List.of(selfDeclared, humanEndorsed, unknownTier), null));

        List<NexusBlendedSearchResult> results = service.search(blendedRequest(), LOGIN_ID).results();

        assertThat(results).filteredOn(r -> "nexus-a".equals(r.nexusCandidateId()))
                .extracting(NexusBlendedSearchResult::matchScore).containsExactly(85);
        assertThat(results).filteredOn(r -> "nexus-b".equals(r.nexusCandidateId()))
                .extracting(NexusBlendedSearchResult::matchScore).containsExactly(97);
        assertThat(results).filteredOn(r -> "nexus-c".equals(r.nexusCandidateId()))
                .extracting(NexusBlendedSearchResult::matchScore).containsExactly(85);
    }

    private NexusSearchResponse.Result nexusResultWithTier(String candidateId, String tier) {
        return new NexusSearchResponse.Result(
                candidateId, "tok-" + candidateId, "Nexus Name", "Senior Engineer", "Melbourne",
                40, 60, tier,
                List.of(new NexusSearchResponse.TopSkill("Java", 90, tier)),
                List.of("SCALE_UP"), true, "WITHIN_BUDGET",
                new NexusSearchResponse.PipelineActivity(0, 0, 0),
                "https://nexus.nolyvra.com/candidates/" + candidateId,
                "https://nexus.nolyvra.com/avatars/" + candidateId,
                "https://linkedin.com/in/" + candidateId, candidateId + "@example.com");
    }

    @Test
    void nexusVerifiedResultsOutrankAHigherRawScoringAtsResultWithinTheBoostMargin() {
        // ATS result scores higher on raw matchScore (70) than the Nexus result's own raw
        // matchScore (60), but the Nexus result's PLATFORM_VERIFIED tier fixes its
        // *displayed* score at 92 (NEXUS_TIER_MATCH_SCORE) plus the +15 ranking boost at
        // sort time — both push it well above the ATS result either way. Sayan-confirmed
        // 2026-07-26 product decisions, see NEXUS_VERIFIED_RANKING_BOOST and
        // NEXUS_TIER_MATCH_SCORE.
        TalentSearchResult internal = internalResult("c-higher-raw-score", "frank@example.com", 70);
        when(talentSearchService.search(any(TalentSearchRequest.class), eq(LOGIN_ID)))
                .thenReturn(talentSearchResponse(internal));
        when(identityTokenService.compute("frank@example.com")).thenReturn("tok-frank");
        when(nexusClient.isConfigured()).thenReturn(true);
        when(talentSearchService.extractNexusSearchFilters(anyString())).thenReturn(new TalentSearchService.NexusSearchFilters(List.of("Java"), null));
        NexusSearchResponse.Result lowerScoringNexusResult = new NexusSearchResponse.Result(
                "nexus-candidate-2", "tok-someone-else", "Nexus Name", "Senior Engineer", "Melbourne",
                60, 60, "PLATFORM_VERIFIED",
                List.of(new NexusSearchResponse.TopSkill("Java", 90, "PLATFORM_VERIFIED")),
                List.of("SCALE_UP"), true, "WITHIN_BUDGET",
                new NexusSearchResponse.PipelineActivity(2, 1, 0),
                "https://nexus.nolyvra.com/candidates/nexus-candidate-2",
                "https://nexus.nolyvra.com/avatars/nexus-candidate-2",
                "https://linkedin.com/in/nexus-name-2", "nexus-name-2@example.com");
        when(nexusClient.searchCandidates(any(NexusSearchRequest.class)))
                .thenReturn(new NexusSearchResponse(List.of(lowerScoringNexusResult), null));

        List<NexusBlendedSearchResult> results = service.search(blendedRequest(), LOGIN_ID).results();

        assertThat(results.get(0).source()).isEqualTo("NEXUS");
        assertThat(results.get(0).matchScore()).isEqualTo(92); // tier-fixed (PLATFORM_VERIFIED), not the raw 60
        assertThat(results.get(1).candidateId()).isEqualTo("c-higher-raw-score");
    }

    private NexusBlendedSearchResult onlyResultWithCandidateId(
            com.nolyvra.app.model.NexusBlendedSearchResponse response, String candidateId) {
        return response.results().stream()
                .filter(r -> candidateId.equals(r.candidateId()))
                .findFirst()
                .orElseThrow();
    }

    private NexusBlendedSearchRequest blendedRequest() {
        return new NexusBlendedSearchRequest("java engineer", null, null, null, null, 0, 9);
    }

    private TalentSearchResponse talentSearchResponse(TalentSearchResult... results) {
        return new TalentSearchResponse("query", results.length, results.length, 0, List.of(results));
    }

    private TalentSearchResult internalResult(String candidateId, String email, int matchScore) {
        return new TalentSearchResult(
                candidateId, "Name", "Engineer", "Acme", "https://linkedin.com/x",
                email, "+61 400 000 000",
                List.of("Java"), List.of(), matchScore, 5,
                "INTERNAL", true, null, null, null, null);
    }

    private TalentSearchResult coresignalResult(int matchScore) {
        return new TalentSearchResult(
                null, "External Name", "Engineer", "Other Co", "https://linkedin.com/y",
                null, null,
                List.of("Java"), List.of(), matchScore, 3,
                "CORESIGNAL", false, "cs-1", "https://avatar", false, null);
    }

    private NexusSearchResponse.Result nexusResult(String identityToken, int credibilityScore) {
        return new NexusSearchResponse.Result(
                "nexus-candidate-1", identityToken, "Nexus Name", "Senior Engineer", "Melbourne",
                85, credibilityScore, "PLATFORM_VERIFIED",
                List.of(new NexusSearchResponse.TopSkill("Java", 90, "PLATFORM_VERIFIED")),
                List.of("SCALE_UP"), true, "WITHIN_BUDGET",
                new NexusSearchResponse.PipelineActivity(2, 1, 0),
                "https://nexus.nolyvra.com/candidates/nexus-candidate-1",
                "https://nexus.nolyvra.com/avatars/nexus-candidate-1",
                "https://linkedin.com/in/nexus-name", "nexus-name@example.com");
    }
}
