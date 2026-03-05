package com.depthhire.app.controller;

import com.depthhire.app.model.JobCreateRequest;
import com.depthhire.app.model.JobResponse;
import com.depthhire.app.service.JobService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/jobs")
public class JobsController {

  private final JobService jobService;

  public JobsController(JobService jobService) {
    this.jobService = jobService;
  }

  @PostMapping
  public JobResponse createJob(@Valid @RequestBody JobCreateRequest req) {
    return jobService.createJob(req);
  }

  @GetMapping
  public List<JobResponse> listJobs() {
    return jobService.listJobs();
  }

  @GetMapping("/{jobId}")
  public JobResponse getJob(@PathVariable String jobId) {
    return jobService.getJob(jobId)
        .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
  }
}