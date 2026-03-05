package com.depthhire.app.controller;

import com.depthhire.app.model.AnalysisRequest;
import com.depthhire.app.model.AnalysisResponse;
import com.depthhire.app.model.CandidateAnalysisResponse;
import com.depthhire.app.model.CandidateResponse;
import com.depthhire.app.service.AnalysisService;
import com.depthhire.app.store.InMemoryStore;
import jakarta.validation.Valid;

import java.util.List;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AnalysisController {

  private final AnalysisService analysisService;

  public AnalysisController(AnalysisService analysisService) {
    this.analysisService = analysisService;
  }

  @PostMapping("/candidates/{candidateId}/analyze")
  public CandidateAnalysisResponse analyze(@PathVariable String candidateId) {

    String jobId = analysisService.getJobIdForCandidate(candidateId);

    return analysisService.analyze(candidateId, jobId);
  }

  /*
   * @GetMapping("/candidates/{candidateId}/analysis")
   * public CandidateAnalysisResponse getAnalysis(@PathVariable String
   * candidateId) {
   * 
   * return analysisService.getAnalysisFromDb(candidateId)
   * .orElseThrow(() -> new IllegalArgumentException(
   * "No analysis found for candidate: " + candidateId));
   * }
   */

  @GetMapping("/analyses/recent")
  public List<AnalysisResponse> getRecentAnalyses() {
    return analysisService.getAnalysesFromDb();
  }

}
