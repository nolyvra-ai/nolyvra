package com.depthhire.app.controller;

import com.depthhire.app.model.CandidateCreateRequest;
import com.depthhire.app.model.CandidateResponse;
import com.depthhire.app.model.StageUpdateRequest;
import com.depthhire.app.service.CandidateService;
import com.depthhire.app.service.WorkflowService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class CandidatesController {

    private final CandidateService candidateService;
    private final WorkflowService workflowService;

    public CandidatesController(CandidateService candidateService, WorkflowService workflowService) {
        this.candidateService = candidateService;
        this.workflowService  = workflowService;
    }

    @PostMapping("/jobs/{jobId}/candidates")
    public CandidateResponse addCandidate(
            @PathVariable String jobId,
            @RequestParam String loginId,
            @Valid @RequestBody CandidateCreateRequest req) {
        CandidateResponse candidate = candidateService.addCandidate(jobId, req, loginId);
        // Record timeline event
        workflowService.recordEvent(candidate.id(), loginId, "CANDIDATE_ADDED",
                "Added to pipeline for " + jobId, null);
        return candidate;
    }

    @GetMapping("/candidates/{candidateId}")
    public CandidateResponse getCandidate(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return candidateService.getCandidate(candidateId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Candidate not found: " + candidateId));
    }

    @GetMapping("/jobs/{jobId}/candidates")
    public List<CandidateResponse> getCandidatesByJob(
            @PathVariable String jobId,
            @RequestParam String loginId) {
        return candidateService.getCandidatesByJob(jobId, loginId);
    }

    // ── MVP2: All candidates (used by Candidates List page) ─────────────────
    @GetMapping("/candidates")
    public List<CandidateResponse> getAllCandidates(@RequestParam String loginId) {
        return candidateService.getAllCandidates(loginId);
    }

    // ── MVP2: Delete candidate ───────────────────────────────────────────────
    @DeleteMapping("/candidates/{candidateId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCandidate(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        boolean deleted = candidateService.deleteCandidate(candidateId, loginId);
        if (!deleted) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Candidate not found: " + candidateId);
        }
    }

    // ── MVP2: Update stage ───────────────────────────────────────────────────
    @PatchMapping("/candidates/{candidateId}/stage")
    public Map<String, String> updateStage(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @Valid @RequestBody StageUpdateRequest req) {
        boolean updated = candidateService.updateStage(candidateId, req, loginId);
        if (!updated) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Candidate not found: " + candidateId);
        }
        workflowService.recordEvent(candidateId, loginId, "STAGE_CHANGED",
                "Stage updated to: " + req.stage(), null);
        return Map.of("stage", req.stage(), "status", "updated");
    }

    // ── MVP2: Update recruiter notes ─────────────────────────────────────────
    @PatchMapping("/candidates/{candidateId}/notes")
    public Map<String, String> updateNotes(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @RequestBody Map<String, String> body) {
        String notes = body.getOrDefault("notes", "");
        candidateService.updateNotes(candidateId, notes, loginId);
        return Map.of("status", "saved");
    }
}
