package com.nolyvra.app.controller;

import com.nolyvra.app.model.CandidateSearchResult;
import com.nolyvra.app.model.ClientBriefRequest;
import com.nolyvra.app.model.ClientBriefResponse;
import com.nolyvra.app.model.JobCreateRequest;
import com.nolyvra.app.model.JobResponse;
import com.nolyvra.app.model.TalentSearchResult;
import com.nolyvra.app.service.JobService;
import com.nolyvra.app.service.TalentSearchService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/jobs")
public class JobsController {

    private final JobService jobService;
    private final TalentSearchService talentSearchService;

    public JobsController(JobService jobService, TalentSearchService talentSearchService) {
        this.jobService = jobService;
        this.talentSearchService = talentSearchService;
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

    // ── Suitable Candidates: top 10 internal matches (title + skills + location) ──
    @GetMapping("/{jobId}/suitable-candidates")
    public List<CandidateSearchResult> getSuitableCandidates(
            @PathVariable String jobId,
            @RequestParam String loginId) {
        JobResponse job = jobService.getJob(jobId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found: " + jobId));
        return talentSearchService.suitableInternalCandidatesForJob(job, loginId);
    }

    // ── External Candidates: 5 cached + 5 fresh from Bright Data, every call ──
    @GetMapping("/{jobId}/external-candidates")
    public List<TalentSearchResult> getExternalCandidates(
            @PathVariable String jobId,
            @RequestParam String loginId) {
        JobResponse job = jobService.getJob(jobId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found: " + jobId));
        return talentSearchService.searchCoreSignalForJob(
                job.stackTags(), job.location(), job.title(), job.seniority());
    }

    // ── "Load more external candidates" (Jobs page) ──────────────────────────
    @GetMapping("/{jobId}/external-candidates/load-more")
    public List<TalentSearchResult> loadMoreExternalCandidates(
            @PathVariable String jobId,
            @RequestParam String loginId) {
        JobResponse job = jobService.getJob(jobId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found: " + jobId));
        return talentSearchService.loadMoreExternalForJob(
                job.stackTags(), job.location(), job.title(), job.seniority());
    }
}
