package com.nolyvra.app.service;

import com.nolyvra.app.model.NexusBlendedLoadMoreRequest;
import com.nolyvra.app.model.NexusBlendedLoadMoreResponse;
import com.nolyvra.app.model.NexusBlendedSearchRequest;
import com.nolyvra.app.model.NexusBlendedSearchResponse;
import com.nolyvra.app.model.NexusBlendedSearchResult;
import com.nolyvra.app.model.NexusSearchRequest;
import com.nolyvra.app.model.NexusSearchResponse;
import com.nolyvra.app.model.TalentSearchRequest;
import com.nolyvra.app.model.TalentSearchResponse;
import com.nolyvra.app.model.TalentSearchResult;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

// Blends the existing ATS talent search (TalentSearchService — untouched, called
// as a black box) with Nexus's candidate search, deduped by identityToken.
// See docs/nexus-integration/shared-contracts.md and the Step 2 design note in
// .claude/sprint-context.md for why this is a separate service/DTO rather than
// an extension of TalentSearchService/TalentSearchResult.
@Service
public class NexusBlendedSearchService {

    private static final NexusSearchResponse EMPTY_NEXUS_RESPONSE = new NexusSearchResponse(List.of(), null);

    // Sayan-confirmed 2026-07-26: NEXUS/BOTH results get a fixed ranking boost over
    // raw matchScore — verification status itself should outweigh a modest score gap.
    // Deliberately a *ranking-order* boost only, applied at sort time — this is a
    // conscious reversal of the original brief's "don't artificially bury ATS
    // candidates" principle, not an oversight — see the Step 2 design note.
    //
    // UPDATE, later the same day: the note this constant used to carry ("never baked
    // into the matchScore value itself — the recruiter should still see each
    // candidate's honest, real score") no longer holds — see NEXUS_TIER_MATCH_SCORE
    // below, which does exactly that for the *displayed* score. This boost still
    // applies on top of that at sort time.
    private static final int NEXUS_VERIFIED_RANKING_BOOST = 15;

    // Sayan-confirmed 2026-07-26: the displayed Match Score for any NEXUS/BOTH result
    // is no longer Nexus's own blended matchScore — it's a fixed value per verification
    // tier, so a verified Nexus candidate never shows a misleadingly-low score (e.g. one
    // driven down by a weak text-relevance component). "Fixed by tier" — chosen over a
    // floor-at-85% or credibility-score-derived alternative. Falls back to the
    // SELF_DECLARED floor (85) for a tier value we don't recognize, rather than 0.
    private static final Map<String, Integer> NEXUS_TIER_MATCH_SCORE = Map.of(
            "SELF_DECLARED", 85,
            "AI_INFERRED", 88,
            "PLATFORM_VERIFIED", 92,
            "HUMAN_ENDORSED", 97
    );

    private static int nexusTierMatchScore(String tier) {
        return NEXUS_TIER_MATCH_SCORE.getOrDefault(tier, 85);
    }

    private final TalentSearchService talentSearchService;
    private final NexusClient nexusClient;
    private final IdentityTokenService identityTokenService;

    public NexusBlendedSearchService(
            TalentSearchService talentSearchService,
            NexusClient nexusClient,
            IdentityTokenService identityTokenService) {
        this.talentSearchService = talentSearchService;
        this.nexusClient = nexusClient;
        this.identityTokenService = identityTokenService;
    }

    public NexusBlendedSearchResponse search(NexusBlendedSearchRequest req, String loginId) {
        TalentSearchResponse atsResponse = talentSearchService.search(
                new TalentSearchRequest(req.query(), "MATCH_SCORE", req.page(), req.pageSize()),
                loginId);

        NexusSearchInputs nexusInputs = resolveNexusSearchInputs(req.query());
        // Prefer an explicit UI filter if one's ever set; fall back to what the AI
        // extracted from the free-text query (e.g. "Melbourne" from "Java Delivery
        // Lead Melbourne") — req.location() is never populated by the frontend today.
        String nexusLocation = req.location() != null && !req.location().isBlank()
                ? req.location() : nexusInputs.location();
        NexusSearchResponse nexusResponse = nexusInputs.skills().isEmpty()
                ? EMPTY_NEXUS_RESPONSE
                : fetchNexusResults(new NexusSearchRequest(
                        req.query(), nexusInputs.skills(), req.minVerificationTier(), nexusLocation,
                        req.remunerationBudget(), req.employerType(), loginId, req.page(), req.pageSize()));
        System.out.println("[NexusBlendedSearch] search: nexusConfigured=" + nexusClient.isConfigured()
                + " skillsSent=" + nexusInputs.skills() + " locationSent=" + nexusLocation
                + " nexusResultCount=" + nexusResponse.results().size());

        // Only INTERNAL results carry a real email — CORESIGNAL never exposes one,
        // so it can never be deduped against a Nexus identityToken. Skip computing
        // tokens entirely when Nexus isn't configured (e.g. IDENTITY_TOKEN_SECRET
        // unset locally) — nexusResponse is already guaranteed empty in that case
        // (fetchNexusResults' own isConfigured() guard), so there's nothing to
        // dedupe against, and IdentityTokenService.compute() would otherwise throw
        // on an empty key instead of degrading gracefully like the rest of this path.
        boolean nexusConfigured = nexusClient.isConfigured();
        Map<String, TalentSearchResult> atsByIdentityToken = new HashMap<>();
        List<TalentSearchResult> unmatchable = new ArrayList<>();
        for (TalentSearchResult r : atsResponse.results()) {
            if (nexusConfigured && "INTERNAL".equals(r.source()) && r.email() != null && !r.email().isBlank()) {
                atsByIdentityToken.put(identityTokenService.compute(r.email()), r);
            } else {
                unmatchable.add(r);
            }
        }

        List<NexusBlendedSearchResult> blended = new ArrayList<>();
        Set<String> mergedTokens = new HashSet<>();

        for (NexusSearchResponse.Result nr : nexusResponse.results()) {
            TalentSearchResult matched = nr.identityToken() != null
                    ? atsByIdentityToken.get(nr.identityToken())
                    : null;
            if (matched != null) {
                mergedTokens.add(nr.identityToken());
            }
            blended.add(toBlended(nr, matched));
        }

        for (Map.Entry<String, TalentSearchResult> entry : atsByIdentityToken.entrySet()) {
            if (!mergedTokens.contains(entry.getKey())) {
                blended.add(toBlended(entry.getValue()));
            }
        }

        for (TalentSearchResult r : unmatchable) {
            blended.add(toBlended(r));
        }

        blended.sort(Comparator.comparingInt(this::rankingScore).reversed());

        long nexusOnlyCount = blended.stream().filter(b -> "NEXUS".equals(b.source())).count();
        long bothCount = blended.stream().filter(b -> "BOTH".equals(b.source())).count();
        System.out.println("[NexusBlendedSearch] search: blend complete — total=" + blended.size()
                + " nexusOnly=" + nexusOnlyCount + " both=" + bothCount
                + " atsOnly=" + (blended.size() - nexusOnlyCount - bothCount)
                + " (nexusMatched/merged=" + mergedTokens.size() + " of " + nexusResponse.results().size() + " Nexus results)");

        return new NexusBlendedSearchResponse(req.query(), blended.size(), blended);
    }

    // Sort key only — never the displayed matchScore. See NEXUS_VERIFIED_RANKING_BOOST.
    private int rankingScore(NexusBlendedSearchResult r) {
        boolean nexusVerified = "NEXUS".equals(r.source()) || "BOTH".equals(r.source());
        return nexusVerified ? Math.min(100, r.matchScore() + NEXUS_VERIFIED_RANKING_BOOST) : r.matchScore();
    }

    // Resolves skills + location to send to Nexus for a query — Nexus's search API
    // requires a non-empty skills list, so an empty skills result here means "don't
    // call Nexus at all" (either it's unconfigured, or genuinely nothing could be
    // extracted). Never let a Nexus outage/misconfiguration/unsatisfiable-request
    // fail the whole search — degrade to ATS-only, same pattern as
    // TalentSearchService's Bright Data blank-API-key check.
    private record NexusSearchInputs(List<String> skills, String location) {
        static final NexusSearchInputs EMPTY = new NexusSearchInputs(List.of(), null);
    }

    private NexusSearchInputs resolveNexusSearchInputs(String query) {
        if (!nexusClient.isConfigured()) {
            System.out.println("[NexusBlendedSearch] Nexus not configured (missing nexus.base-url or "
                    + "nexus.service-token) — skipping Nexus call, returning ATS-only results");
            return NexusSearchInputs.EMPTY;
        }
        TalentSearchService.NexusSearchFilters filters = talentSearchService.extractNexusSearchFilters(query);
        if (filters.skills().isEmpty()) {
            System.out.println("[NexusBlendedSearch] No skills or keywords extracted from \"" + query
                    + "\" — Nexus requires non-empty skills, skipping Nexus call for this query");
        }
        return new NexusSearchInputs(filters.skills(), filters.location());
    }

    private NexusSearchResponse fetchNexusResults(NexusSearchRequest nexusReq) {
        try {
            NexusSearchResponse resp = nexusClient.searchCandidates(nexusReq);
            return resp != null ? resp : EMPTY_NEXUS_RESPONSE;
        } catch (Exception e) {
            // NexusClient already logs the detailed failure (status/body or exception
            // type) — this line just confirms the degrade decision at this level.
            System.err.println("[NexusBlendedSearch] Nexus search failed, degrading to ATS-only: "
                    + e.getClass().getSimpleName() + ": " + e.getMessage());
            return EMPTY_NEXUS_RESPONSE;
        }
    }

    // ─── Load more (CoreSignal fresh batch + Nexus next page) ────────────────
    // Only used by the page's separate "Load More External Candidates" button —
    // never deals with INTERNAL/BOTH, matching what TalentSearchService.loadMoreExternal
    // already scopes to (CoreSignal-only, no page counter of its own).

    public NexusBlendedLoadMoreResponse loadMoreExternal(NexusBlendedLoadMoreRequest req, String loginId) {
        List<TalentSearchResult> coreSignalFresh = talentSearchService.loadMoreExternal(req.query(), loginId);
        NexusSearchInputs nexusInputs = resolveNexusSearchInputs(req.query());
        NexusSearchResponse nexusResponse = nexusInputs.skills().isEmpty()
                ? EMPTY_NEXUS_RESPONSE
                : fetchNexusResults(new NexusSearchRequest(
                        req.query(), nexusInputs.skills(), null, nexusInputs.location(), null, null, loginId, req.nexusPage(), null));

        List<NexusBlendedSearchResult> combined = new ArrayList<>();
        for (TalentSearchResult r : coreSignalFresh) {
            combined.add(toBlended(r));
        }
        for (NexusSearchResponse.Result nr : nexusResponse.results()) {
            combined.add(toBlended(nr, null));
        }
        System.out.println("[NexusBlendedSearch] loadMoreExternal: nexusConfigured=" + nexusClient.isConfigured()
                + " skillsSent=" + nexusInputs.skills() + " coreSignalFresh=" + coreSignalFresh.size()
                + " nexusResultCount=" + nexusResponse.results().size() + " combined=" + combined.size());
        return new NexusBlendedLoadMoreResponse(combined);
    }

    // ─── Nexus-only or Nexus+ATS merged result (source = NEXUS or BOTH) ──────

    private NexusBlendedSearchResult toBlended(NexusSearchResponse.Result nr, TalentSearchResult matched) {
        boolean isBoth = matched != null;
        return new NexusBlendedSearchResult(
                isBoth ? matched.candidateId() : null,
                nr.candidateId(),
                nr.displayName(),
                nr.title(),
                isBoth ? matched.currentCompany() : null,
                isBoth ? matched.linkedinUrl() : nr.linkedinUrl(),
                isBoth ? matched.email() : nr.email(),
                // Phone stays gated regardless of source — never surfaced except via the
                // consent + phone-reveal flow. Unaffected by the v0.8 email/avatarUrl/
                // linkedinUrl reversal (see docs/nexus-integration/shared-contracts.md).
                isBoth ? matched.phone() : null,
                isBoth ? matched.matchedSkills() : List.of(),
                isBoth ? matched.gapSkills() : List.of(),
                nexusTierMatchScore(nr.tier()),
                isBoth ? matched.yearsExperience() : 0,
                isBoth ? matched.avatarUrl() : nr.avatarUrl(),
                isBoth ? matched.defaultAvatar() : null,
                isBoth ? "BOTH" : "NEXUS",
                isBoth,
                nr.location(),
                nr.identityToken(),
                nr.credibilityScore(),
                nr.tier(),
                nr.topSkills(),
                nr.employerPreferences(),
                nr.pipelineActivity(),
                nr.nexusProfileUrl(),
                null, null);
    }

    // ─── ATS-only result, no Nexus match (source = ATS) ──────────────────────

    private NexusBlendedSearchResult toBlended(TalentSearchResult r) {
        return new NexusBlendedSearchResult(
                r.candidateId(),
                null,
                r.name(),
                r.currentTitle(),
                r.currentCompany(),
                r.linkedinUrl(),
                r.email(),
                r.phone(),
                r.matchedSkills(),
                r.gapSkills(),
                r.matchScore(),
                r.yearsExperience(),
                r.avatarUrl(),
                r.defaultAvatar(),
                r.source(),
                r.alreadyInPipeline(),
                null, null, null, null, null, null, null, null,
                r.coresignalId(), r.coreSignalApiId());
    }
}
