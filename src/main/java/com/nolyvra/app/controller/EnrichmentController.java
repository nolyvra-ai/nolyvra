package com.nolyvra.app.controller;

import com.nolyvra.app.model.EnrichmentResultResponse;
import com.nolyvra.app.model.EnrichmentStartRequest;
import com.nolyvra.app.model.EnrichmentStartResponse;
import com.nolyvra.app.service.EnrichmentService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/enrichment")
public class EnrichmentController {

    private final EnrichmentService enrichmentService;

    public EnrichmentController(EnrichmentService enrichmentService) {
        this.enrichmentService = enrichmentService;
    }

    @PostMapping("/start")
    public EnrichmentStartResponse start(
            @RequestParam String loginId,
            @RequestBody EnrichmentStartRequest request) {
        return enrichmentService.start(request, loginId);
    }

    @GetMapping("/{jobId}")
    public EnrichmentResultResponse getResult(
            @PathVariable String jobId,
            @RequestParam String loginId,
            @RequestParam(required = false) String candidateId) {
        return enrichmentService.getResult(jobId, candidateId, loginId);
    }
}
