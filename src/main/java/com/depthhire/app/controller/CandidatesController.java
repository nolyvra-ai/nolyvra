package com.depthhire.app.controller;

import com.depthhire.app.model.CandidateCreateRequest;
import com.depthhire.app.model.CandidateResponse;
import com.depthhire.app.store.InMemoryStore;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CandidatesController {

  private final InMemoryStore store;

  public CandidatesController(InMemoryStore store) {
    this.store = store;
  }

  @PostMapping("/jobs/{jobId}/candidates")
  public CandidateResponse addCandidate(@PathVariable String jobId, @Valid @RequestBody CandidateCreateRequest req) {
    // MVP: ignore cvText (or store it later); we keep it in-memory / front-end for now
    store.getJob(jobId).orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
    return store.saveCandidate(jobId, req.name(), req.email(), req.linkedinUrl());
  }

  @GetMapping("/candidates/{candidateId}")
  public CandidateResponse getCandidate(@PathVariable String candidateId) {
    return store.getCandidate(candidateId)
        .orElseThrow(() -> new IllegalArgumentException("Candidate not found: " + candidateId));
  }
}
