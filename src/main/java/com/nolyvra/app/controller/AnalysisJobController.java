package com.nolyvra.app.controller;

import com.nolyvra.app.model.AnalysisJobBatchResponse;
import com.nolyvra.app.model.AnalysisJobBulkRequest;
import com.nolyvra.app.service.AnalysisJobService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/analysis-jobs")
public class AnalysisJobController {

    private final AnalysisJobService analysisJobService;

    public AnalysisJobController(AnalysisJobService analysisJobService) {
        this.analysisJobService = analysisJobService;
    }

    @PostMapping("/bulk")
    public AnalysisJobBatchResponse enqueueBulk(
            @RequestParam String loginId,
            @RequestBody AnalysisJobBulkRequest request) {
        return analysisJobService.enqueueBulk(request.candidateIds(), loginId);
    }

    @GetMapping("/batches/{batchId}")
    public AnalysisJobBatchResponse getBatchStatus(
            @PathVariable String batchId,
            @RequestParam String loginId) {
        return analysisJobService.getBatchStatus(batchId, loginId);
    }
}

