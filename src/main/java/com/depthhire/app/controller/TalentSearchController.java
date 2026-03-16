package com.depthhire.app.controller;

import com.depthhire.app.model.TalentSearchRequest;
import com.depthhire.app.model.TalentSearchResponse;
import com.depthhire.app.service.TalentSearchService;
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
}
