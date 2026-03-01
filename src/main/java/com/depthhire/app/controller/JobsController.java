package com.depthhire.app.controller;

import com.depthhire.app.model.JobCreateRequest;
import com.depthhire.app.model.JobResponse;
import com.depthhire.app.store.InMemoryStore;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/jobs")
public class JobsController {

  private final InMemoryStore store;

  public JobsController(InMemoryStore store) {
    this.store = store;
  }

  @PostMapping
  public JobResponse createJob(@Valid @RequestBody JobCreateRequest req) {
    return store.saveJob(req.title(), req.seniority(), req.jdText(), req.stackTags());
  }

  @GetMapping
  public List<JobResponse> listJobs() {
    return store.listJobs();
  }

  @GetMapping("/{jobId}")
  public JobResponse getJob(@PathVariable String jobId) {
    return store.getJob(jobId).orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
  }
}
