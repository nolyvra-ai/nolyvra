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
  public JobResponse createJob(@Valid @RequestBody JobCreateRequest req, @RequestParam String loginId) {
    return jobService.createJob(req, loginId);
  }

  @GetMapping
  public List<JobResponse> listJobs(@RequestParam String loginId) {
    return jobService.listJobs(loginId);
  }

  @GetMapping("/{jobId}")
  public JobResponse getJob(@PathVariable String jobId, @RequestParam String loginId) {
    return jobService.getJob(jobId, loginId)
        .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
  }
}