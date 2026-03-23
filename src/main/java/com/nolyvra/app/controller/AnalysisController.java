package com.nolyvra.app.controller;

import com.nolyvra.app.model.*;
import com.nolyvra.app.service.AnalysisService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api")
public class AnalysisController {

    private final AnalysisService analysisService;

    public AnalysisController(AnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    // ── Existing endpoints (unchanged) ────────────────────────────────────────

    @PostMapping("/candidates/{candidateId}/analyze")
    public CandidateAnalysisResponse analyze(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
         CandidateAnalysisResponse candidateAnalysisResponse = analysisService.getAIAnalysisForCandidate(candidateId);
        if (null != candidateAnalysisResponse) {
            System.out.println("Old candidate");
            return candidateAnalysisResponse;
        }
        CandidateResponse candidate = analysisService.getJobIdNameForCandidate(candidateId);
        return analysisService.analyze(candidateId, candidate, loginId);
    }

    @GetMapping("/candidates/{candidateId}/analysis")
    public AnalysisResponse getAnalysis(@PathVariable String candidateId) {
        List<AnalysisResponse> rows = analysisService.getAnalysisForCandidate(candidateId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @GetMapping("/candidates/{candidateId}/aianalysis")
    public CandidateAnalysisResponse getAIAnalysis(@PathVariable String candidateId) {
        return analysisService.getAIAnalysisForCandidate(candidateId);
    }

    @GetMapping("/analyses/recent")
    public List<AnalysisResponse> getRecentAnalyses(@RequestParam String loginId) {
        return analysisService.getAnalysesFromDb(loginId);
    }

    // ── MVP2: AI Candidate Summary ────────────────────────────────────────────
    @GetMapping("/candidates/{candidateId}/analysis/summary")
    public CandidateSummaryResponse getCandidateSummary(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return analysisService.getCandidateSummary(candidateId, loginId);
    }

    // ── MVP2: Fraud Detection ─────────────────────────────────────────────────
    @GetMapping("/candidates/{candidateId}/analysis/fraud-signals")
    public FraudSignalResponse getFraudSignals(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return analysisService.getFraudSignals(candidateId, loginId);
    }

    // ── MVP2: Placement Probability ───────────────────────────────────────────
    @GetMapping("/candidates/{candidateId}/analysis/placement-probability")
    public PlacementProbabilityResponse getPlacementProbability(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return analysisService.getPlacementProbability(candidateId, loginId);
    }
}
