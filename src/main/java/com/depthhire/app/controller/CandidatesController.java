package com.depthhire.app.controller;

import com.depthhire.app.model.CandidateCreateRequest;
import com.depthhire.app.model.CandidateResponse;
import com.depthhire.app.service.CandidateService;
import jakarta.validation.Valid;

import java.util.List;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CandidatesController {

  private final CandidateService candidateService;

  public CandidatesController(CandidateService candidateService) {
    this.candidateService = candidateService;
  }

  @PostMapping("/jobs/{jobId}/candidates")
  public CandidateResponse addCandidate(@PathVariable String jobId,
      @Valid @RequestBody CandidateCreateRequest req) {
    return candidateService.addCandidate(jobId, req);
  }

  @GetMapping("/candidates/{candidateId}")
  public CandidateResponse getCandidate(@PathVariable String candidateId) {
    return candidateService.getCandidate(candidateId)
        .orElseThrow(() -> new IllegalArgumentException("Candidate not found: " + candidateId));
  }

  @GetMapping("/jobs/{jobId}/candidates")
  public List<CandidateResponse> getCandidatesByJob(@PathVariable String jobId) {
    return candidateService.getCandidatesByJob(jobId);
  }

}