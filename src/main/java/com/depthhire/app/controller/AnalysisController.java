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
  public CandidateAnalysisResponse analyze(@PathVariable String candidateId, @RequestParam String loginId) {

    CandidateResponse candidateResponse = analysisService.getJobIdNameForCandidate(candidateId);

    return analysisService.analyze(candidateId, candidateResponse,loginId);
  }

  
    @GetMapping("/candidates/{candidateId}/analysis")
    public AnalysisResponse getAnalysis(@PathVariable String
    candidateId) {
    
      System.out.println("Inside AnalysisResponse: candidateId: " + candidateId);
      List<AnalysisResponse> analysisResponse = analysisService.getAnalysisForCandidate(candidateId);
      if(!analysisResponse.isEmpty()){
        System.out.println("The response is " + analysisResponse);
        return analysisResponse.get(0);
      }
      System.out.println("Not Null value");
      return null;
    }

    @GetMapping("/candidates/{candidateId}/aianalysis")
    public CandidateAnalysisResponse getAIAnalysis(@PathVariable String
    candidateId) {
    
      System.out.println("Inside AIAnalysisResponse: candidateId: " + candidateId);
      return analysisService.getAIAnalysisForCandidate(candidateId);
    }
 

  @GetMapping("/analyses/recent")
  public List<AnalysisResponse> getRecentAnalyses(@RequestParam String loginId) {
    return analysisService.getAnalysesFromDb(loginId);
  }

}
