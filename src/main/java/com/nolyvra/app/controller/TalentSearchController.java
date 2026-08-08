package com.nolyvra.app.controller;

import com.nolyvra.app.model.CoreSignalProfileResponse;
import com.nolyvra.app.model.ExternalLoadMoreRequest;
import com.nolyvra.app.model.TalentSearchRequest;
import com.nolyvra.app.model.TalentSearchResponse;
import com.nolyvra.app.model.TalentSearchResult;
import com.nolyvra.app.service.TalentSearchService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/talent-search")
public class TalentSearchController {

    private final TalentSearchService talentSearchService;

    public TalentSearchController(TalentSearchService talentSearchService) {
        this.talentSearchService = talentSearchService;
    }

    @PostMapping("/query")
    public TalentSearchResponse search(
            @Valid @RequestBody TalentSearchRequest req,
            @RequestParam String loginId) {
        return talentSearchService.search(req, loginId);
    }

    @GetMapping("/coresignal/{coresignalId}")
    public CoreSignalProfileResponse getCoreSignalProfile(
            @PathVariable String coresignalId,
            @RequestParam String loginId) {
        return talentSearchService.getCoreSignalProfile(coresignalId);
    }

    @GetMapping("/coresignal-api/{coreSignalApiId}")
    public CoreSignalProfileResponse getCoreSignalApiProfile(
            @PathVariable Long coreSignalApiId,
            @RequestParam String loginId) {
        return talentSearchService.getCoreSignalApiProfile(coreSignalApiId);
    }

    // ── "Load more external candidates" (Talent Search page) ─────────────────
    @PostMapping("/external/load-more")
    public List<TalentSearchResult> loadMoreExternal(
            @Valid @RequestBody ExternalLoadMoreRequest req,
            @RequestParam String loginId) {
        return talentSearchService.loadMoreExternal(req.query(), loginId);
    }
}
