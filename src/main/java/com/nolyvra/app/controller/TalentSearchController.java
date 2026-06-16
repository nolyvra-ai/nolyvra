package com.nolyvra.app.controller;

import com.nolyvra.app.model.CoreSignalProfileResponse;
import com.nolyvra.app.model.TalentSearchRequest;
import com.nolyvra.app.model.TalentSearchResponse;
import com.nolyvra.app.service.TalentSearchService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

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
            @PathVariable Long coresignalId,
            @RequestParam String loginId) {
        return talentSearchService.getCoreSignalProfile(coresignalId);
    }
}
