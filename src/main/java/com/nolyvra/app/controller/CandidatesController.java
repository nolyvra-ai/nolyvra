package com.nolyvra.app.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.CandidateCreateRequest;
import com.nolyvra.app.model.CandidateListItemResponse;
import com.nolyvra.app.model.CandidateResponse;
import com.nolyvra.app.model.StageUpdateRequest;
import com.nolyvra.app.service.CandidateService;
import com.nolyvra.app.service.InterviewQuestionsService;
import com.nolyvra.app.service.WorkflowService;
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
    private final InterviewQuestionsService interviewQuestionsService;
    private final ObjectMapper objectMapper;

    public CandidatesController(CandidateService candidateService,
                                WorkflowService workflowService,
                                InterviewQuestionsService interviewQuestionsService,
                                ObjectMapper objectMapper) {
        this.candidateService          = candidateService;
        this.workflowService           = workflowService;
        this.interviewQuestionsService = interviewQuestionsService;
        this.objectMapper              = objectMapper;
    }

    // CHANGE: wrap with try/catch to return 409 on duplicate
    @PostMapping("/jobs/{jobId}/candidates")
    public CandidateResponse addCandidate(
            @PathVariable String jobId,
            @RequestParam String loginId,
            @Valid @RequestBody CandidateCreateRequest req) {
        try {
            CandidateResponse candidate = candidateService.addCandidate(jobId, req, loginId);
            // Record timeline event
            workflowService.recordEvent(candidate.id(), loginId, "CANDIDATE_ADDED",
                    "Added to pipeline for " + jobId, null);
            return candidate;
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    // Add candidate without a job assignment ("Not Assigned")
    // CHANGE: wrap with try/catch to return 409 on duplicate
    @PostMapping("/candidates")
    public CandidateResponse addCandidateUnassigned(
            @RequestParam String loginId,
            @Valid @RequestBody CandidateCreateRequest req) {
        try {
            return candidateService.addCandidateUnassigned(req, loginId);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
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

    @GetMapping("/candidates/list")
    public List<CandidateListItemResponse> getCandidateList(@RequestParam String loginId) {
        return candidateService.getCandidateList(loginId);
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

    // ── Interview Questions: generate via OpenAI ──────────────────────────────
    @PostMapping("/candidates/{candidateId}/interview-questions/generate")
    public JsonNode generateInterviewQuestions(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        String json = interviewQuestionsService.generateQuestions(candidateId, loginId);
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to parse AI response: " + e.getMessage());
        }
    }

    // ── Interview Questions: save ─────────────────────────────────────────────
    @PatchMapping("/candidates/{candidateId}/interview-questions")
    public Map<String, String> saveInterviewQuestions(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @RequestBody Map<String, Object> body) throws Exception {
        Object qs = body.get("questions");
        String questionsStr = (qs instanceof String s)
                ? s
                : objectMapper.writeValueAsString(qs);
        interviewQuestionsService.saveQuestions(candidateId, loginId, questionsStr);
        return Map.of("status", "saved");
    }
}
