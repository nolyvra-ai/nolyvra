package com.depthhire.app.controller;

import com.depthhire.app.model.AnalysisRequest;
import com.depthhire.app.model.CandidateAnalysisResponse;
import com.depthhire.app.service.AnalysisService;
import com.depthhire.app.store.InMemoryStore;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AnalysisController {

  private final InMemoryStore store;
  private final AnalysisService analysisService;

  public AnalysisController(InMemoryStore store,
      AnalysisService analysisService) {
    this.store = store;
    this.analysisService = analysisService;
  }

  @PostMapping("/candidates/{candidateId}/analyze")
  public CandidateAnalysisResponse analyze(
      @PathVariable String candidateId,
      @Valid @RequestBody AnalysisRequest request) {

    /* Enable the validations once have proper candidateID and JobId from DB */

    /*
     * var candidate = store.getCandidate(candidateId)
     * .orElseThrow(() -> new IllegalArgumentException("Candidate not found: " +
     * candidateId));
     * 
     * var jobId = store.getCandidateJobId(candidateId)
     * .orElseThrow(() -> new IllegalArgumentException("Candidate has no job: " +
     * candidateId));
     */
    candidateId="johnB";
    String jobId = "11225";
    return analysisService.analyze(candidateId, jobId, request);
  }

  @GetMapping("/candidates/{candidateId}/analysis")
  public CandidateAnalysisResponse getAnalysis(@PathVariable String candidateId) {
    return analysisService.getCachedAnalysis(candidateId)
        .orElseThrow(() -> new IllegalArgumentException("No analysis found for candidate: " + candidateId));
  }
}
