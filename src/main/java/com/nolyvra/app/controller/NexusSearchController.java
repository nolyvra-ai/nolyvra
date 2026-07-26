package com.nolyvra.app.controller;

import com.nolyvra.app.model.NexusBlendedLoadMoreRequest;
import com.nolyvra.app.model.NexusBlendedLoadMoreResponse;
import com.nolyvra.app.model.NexusBlendedSearchRequest;
import com.nolyvra.app.model.NexusBlendedSearchResponse;
import com.nolyvra.app.model.NexusConsentActionRequest;
import com.nolyvra.app.model.NexusMessageComposeRequest;
import com.nolyvra.app.model.NexusPhoneRevealResponse;
import com.nolyvra.app.model.NexusThreadResponse;
import com.nolyvra.app.service.NexusBlendedSearchService;
import com.nolyvra.app.service.NexusConsentService;
import com.nolyvra.app.service.NexusMessagingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/talent-search")
public class NexusSearchController {

    private final NexusBlendedSearchService nexusBlendedSearchService;
    private final NexusMessagingService nexusMessagingService;
    private final NexusConsentService nexusConsentService;

    public NexusSearchController(
            NexusBlendedSearchService nexusBlendedSearchService,
            NexusMessagingService nexusMessagingService,
            NexusConsentService nexusConsentService) {
        this.nexusBlendedSearchService = nexusBlendedSearchService;
        this.nexusMessagingService = nexusMessagingService;
        this.nexusConsentService = nexusConsentService;
    }

    @PostMapping("/nexus-blend")
    public NexusBlendedSearchResponse search(
            @Valid @RequestBody NexusBlendedSearchRequest req,
            @RequestParam String loginId) {
        return nexusBlendedSearchService.search(req, loginId);
    }

    @PostMapping("/nexus-blend/load-more")
    public NexusBlendedLoadMoreResponse loadMoreExternal(
            @Valid @RequestBody NexusBlendedLoadMoreRequest req,
            @RequestParam String loginId) {
        return nexusBlendedSearchService.loadMoreExternal(req, loginId);
    }

    @PostMapping("/nexus-blend/message")
    public NexusThreadResponse sendMessage(
            @Valid @RequestBody NexusMessageComposeRequest req,
            @RequestParam String loginId) {
        return nexusMessagingService.sendMessage(req.nexusCandidateId(), req.body(), loginId);
    }

    @PostMapping("/nexus-blend/consent-request")
    @ResponseStatus(HttpStatus.CREATED)
    public void requestConsent(
            @Valid @RequestBody NexusConsentActionRequest req,
            @RequestParam String loginId) {
        nexusConsentService.requestConsent(req.nexusCandidateId(), loginId);
    }

    @PostMapping("/nexus-blend/phone-reveal")
    public NexusPhoneRevealResponse revealPhone(
            @Valid @RequestBody NexusConsentActionRequest req,
            @RequestParam String loginId) {
        return nexusConsentService.revealPhone(req.nexusCandidateId(), loginId);
    }
}
