package com.depthhire.app.controller;

import com.depthhire.app.model.ClientBriefRequest;
import com.depthhire.app.model.ClientBriefResponse;
import com.depthhire.app.model.JobCreateRequest;
import com.depthhire.app.model.JobResponse;
import com.depthhire.app.service.JobService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/jobs")
public class JobsController {

    private final JobService jobService;

    public JobsController(JobService jobService) {
        this.jobService = jobService;
    }

    @PostMapping
    public JobResponse createJob(
            @Valid @RequestBody JobCreateRequest req,
            @RequestParam String loginId) {
        return jobService.createJob(req, loginId);
    }

    @GetMapping
    public List<JobResponse> listJobs(@RequestParam String loginId) {
        return jobService.listJobs(loginId);
    }

    @GetMapping("/{jobId}")
    public JobResponse getJob(
            @PathVariable String jobId,
            @RequestParam String loginId) {
        return jobService.getJob(jobId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found: " + jobId));
    }

    // ── MVP2: Update job ─────────────────────────────────────────────────────
    @PutMapping("/{jobId}")
    public JobResponse updateJob(
            @PathVariable String jobId,
            @Valid @RequestBody JobCreateRequest req,
            @RequestParam String loginId) {
        return jobService.updateJob(jobId, req, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found: " + jobId));
    }

    // ── MVP2: Delete job ─────────────────────────────────────────────────────
    @DeleteMapping("/{jobId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteJob(
            @PathVariable String jobId,
            @RequestParam String loginId) {
        boolean deleted = jobService.deleteJob(jobId, loginId);
        if (!deleted) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found: " + jobId);
        }
    }

    // ── MVP2: AI Client Brief Analyzer ───────────────────────────────────────
    @PostMapping("/analyze-brief")
    public ClientBriefResponse analyzeClientBrief(
            @RequestParam(required = false, defaultValue = "") String loginId,
            @Valid @RequestBody ClientBriefRequest req) {
        return jobService.analyzeClientBrief(req, loginId);
    }
}
