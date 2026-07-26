package com.nolyvra.app.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.CandidateCreateRequest;
import com.nolyvra.app.model.CandidateExperienceResponse;
import com.nolyvra.app.model.CandidateFileResponse;
import com.nolyvra.app.model.CandidateFilterRequest;
import com.nolyvra.app.model.CandidateListItemResponse;
import com.nolyvra.app.model.CandidateResponse;
import com.nolyvra.app.model.CandidateSearchResult;
import com.nolyvra.app.model.CandidateUpdateRequest;
import com.nolyvra.app.model.JobApplicationResponse;
import com.nolyvra.app.model.StageUpdateRequest;
import com.nolyvra.app.service.CandidateExperienceService;
import com.nolyvra.app.service.CandidateFileService;
import com.nolyvra.app.service.CandidateService;
import com.nolyvra.app.service.CvFormatService;
import com.nolyvra.app.service.InterviewQuestionsService;
import com.nolyvra.app.service.JobApplicationService;
import com.nolyvra.app.service.NexusPipelineEventPublisher;
import com.nolyvra.app.service.TalentSearchService;
import com.nolyvra.app.service.WorkflowService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class CandidatesController {

    private final CandidateService candidateService;
    private final WorkflowService workflowService;
    private final InterviewQuestionsService interviewQuestionsService;
    private final TalentSearchService talentSearchService;
    private final CvFormatService cvFormatService;
    private final CandidateFileService candidateFileService;
    private final CandidateExperienceService candidateExperienceService;
    private final JobApplicationService jobApplicationService;
    private final ObjectMapper objectMapper;
    private final NexusPipelineEventPublisher nexusPipelineEventPublisher;

    public CandidatesController(CandidateService candidateService,
                                WorkflowService workflowService,
                                InterviewQuestionsService interviewQuestionsService,
                                TalentSearchService talentSearchService,
                                CvFormatService cvFormatService,
                                CandidateFileService candidateFileService,
                                CandidateExperienceService candidateExperienceService,
                                JobApplicationService jobApplicationService,
                                ObjectMapper objectMapper,
                                NexusPipelineEventPublisher nexusPipelineEventPublisher) {
        this.candidateService          = candidateService;
        this.workflowService           = workflowService;
        this.interviewQuestionsService = interviewQuestionsService;
        this.talentSearchService       = talentSearchService;
        this.cvFormatService           = cvFormatService;
        this.candidateFileService      = candidateFileService;
        this.candidateExperienceService = candidateExperienceService;
        this.jobApplicationService     = jobApplicationService;
        this.objectMapper              = objectMapper;
        this.nexusPipelineEventPublisher = nexusPipelineEventPublisher;
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
                    "Added to pipeline for " + jobId, null, jobId);
            nexusPipelineEventPublisher.publishAddedToPipeline(candidate.id(), loginId);
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

    @GetMapping("/candidates/count")
    public Map<String, Integer> getCandidateCount(@RequestParam String loginId) {
        return Map.of("count", candidateService.getActiveCandidateCount(loginId));
    }

    // ── Edit Profile: update an existing candidate's core fields ─────────────
    @PutMapping("/candidates/{candidateId}")
    public CandidateResponse updateCandidate(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @Valid @RequestBody CandidateUpdateRequest req) {
        try {
            return candidateService.updateCandidate(candidateId, req, loginId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Candidate not found: " + candidateId));
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

    // ── Candidate <-> Job Application (many-to-many) — not wired into any UI
    // yet, but the backend is ready for the Phase 2 "Jobs Applied" tab ───────
    @GetMapping("/candidates/{candidateId}/applications")
    public List<JobApplicationResponse> getApplications(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return candidateService.getApplications(candidateId, loginId);
    }

    @PostMapping("/candidates/{candidateId}/applications")
    public CandidateResponse addApplication(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @RequestParam String jobId) {
        try {
            return candidateService.addApplication(candidateId, jobId, loginId);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    // ── Format CV: stamp candidate data into a recruiter's stored .docx
    // template (merge fields), optionally including the analysis score ───────
    @PostMapping("/candidates/{candidateId}/format-cv")
    public ResponseEntity<byte[]> formatCv(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @RequestParam String templateId,
            @RequestParam(defaultValue = "false") boolean attachScore) {
        byte[] docx = cvFormatService.formatCv(candidateId, loginId, templateId, attachScore);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"formatted-cv-" + candidateId + ".docx\"")
                .body(docx);
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

    // ── Smart Talent Lens: structured filter search over internal candidates ──
    // Rule-based match scoring only — no OpenAI call, no token deduction.
    @PostMapping("/candidates/search")
    public List<CandidateSearchResult> searchCandidates(
            @RequestParam String loginId,
            @RequestBody CandidateFilterRequest filters) {
        return talentSearchService.scoreInternalCandidates(filters, loginId);
    }

    // ── Bulk upload candidates from CSV (Excel requires conversion to CSV) ───
    @PostMapping("/candidates/bulk-upload")
    public Map<String, Object> bulkUpload(
            @RequestParam String loginId,
            @RequestParam("file") MultipartFile file) {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!filename.matches("(?i).*\\.(csv|xlsx|xls)$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "File must be .csv, .xlsx, or .xls");
        }
        if (filename.matches("(?i).*\\.(xlsx|xls)$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Excel files are not supported server-side. Please convert to CSV and re-upload.");
        }
        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            String[] lines = content.split("\\r?\\n");
            if (lines.length < 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "CSV must have a header row and at least one data row");
            }
            String[] headers = lines[0].split(",");
            Map<String, Integer> colIdx = new HashMap<>();
            for (int i = 0; i < headers.length; i++) {
                colIdx.put(headers[i].trim().toLowerCase().replaceAll("[^a-z_]", ""), i);
            }
            int nameIdx     = firstPresent(colIdx, "name", "full_name", "candidate_name", "fullname");
            int emailIdx    = firstPresent(colIdx, "email", "email_address");
            int phoneIdx    = firstPresent(colIdx, "phone", "phone_number", "phonenumber", "mobile");
            int linkedinIdx = firstPresent(colIdx, "linkedin", "linkedin_url", "linkedinurl");
            if (nameIdx < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "CSV must include a 'name' column");
            }
            int imported = 0;
            int total = 0;
            for (int i = 1; i < lines.length; i++) {
                String line = lines[i].trim();
                if (line.isEmpty()) continue;
                total++;
                String[] cols = parseCsvLine(line);
                String name = col(cols, nameIdx);
                if (name == null || name.isBlank()) continue;
                try {
                    candidateService.addCandidateUnassigned(
                            CandidateCreateRequest.builder()
                                    .name(name)
                                    .email(col(cols, emailIdx))
                                    .linkedinUrl(col(cols, linkedinIdx))
                                    .phone(col(cols, phoneIdx))
                                    .build(),
                            loginId);
                    imported++;
                } catch (IllegalStateException ignored) {
                    // skip duplicates silently
                }
            }
            return Map.of("imported", imported, "total", total);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to parse CSV: " + e.getMessage());
        }
    }

    private int firstPresent(Map<String, Integer> map, String... keys) {
        for (String k : keys) {
            if (map.containsKey(k)) return map.get(k);
        }
        return -1;
    }

    private String col(String[] cols, int idx) {
        if (idx < 0 || idx >= cols.length) return null;
        String v = cols[idx].trim();
        return v.isEmpty() ? null : v;
    }

    private String[] parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                result.add(current.toString());
                current = new StringBuilder();
            } else {
                current.append(c);
            }
        }
        result.add(current.toString());
        return result.toArray(new String[0]);
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
        nexusPipelineEventPublisher.publishStageChanged(candidateId, loginId, req.stage());
        return Map.of("stage", req.stage(), "status", "updated");
    }

    // ── Per-job-application stage (Phase 2A — Jobs Applied tab approve/reject) ─
    // Unlike the candidate-level PATCH above (which moves the person's cached
    // "most recent" stage), this targets one specific job_applications row —
    // approving/rejecting a candidate for Job A no longer touches Job B.
    @PatchMapping("/candidates/{candidateId}/applications/{applicationId}/stage")
    public Map<String, String> updateApplicationStage(
            @PathVariable String candidateId,
            @PathVariable String applicationId,
            @RequestParam String loginId,
            @Valid @RequestBody StageUpdateRequest req) {
        jobApplicationService.updateStage(applicationId, req.stage(), loginId);
        if (req.recruiterNotes() != null) {
            candidateService.updateNotes(candidateId, req.recruiterNotes(), loginId);
        }
        workflowService.recordEvent(candidateId, loginId, "STAGE_CHANGED",
                "Stage updated to: " + req.stage(), null);
        nexusPipelineEventPublisher.publishStageChanged(candidateId, loginId, req.stage());
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
    // jobId is optional — pass it from the Jobs Applied tab to target one
    // specific application; omit it for the old job-agnostic behavior.
    @PostMapping("/candidates/{candidateId}/interview-questions/generate")
    public JsonNode generateInterviewQuestions(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @RequestParam(required = false) String jobId) {
        String json = interviewQuestionsService.generateQuestions(candidateId, loginId, jobId);
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
            @RequestParam(required = false) String jobId,
            @RequestBody Map<String, Object> body) throws Exception {
        Object qs = body.get("questions");
        String questionsStr = (qs instanceof String s)
                ? s
                : objectMapper.writeValueAsString(qs);
        interviewQuestionsService.saveQuestions(candidateId, loginId, questionsStr, jobId);
        return Map.of("status", "saved");
    }

    // ── Files (Phase 2A — candidate detail page's Files tab) ──────────────────

    @GetMapping("/candidates/{candidateId}/files")
    public ResponseEntity<List<CandidateFileResponse>> getCandidateFiles(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return ResponseEntity.ok(candidateFileService.getCandidateFiles(candidateId, loginId));
    }

    @PostMapping(value = "/candidates/{candidateId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CandidateFileResponse> uploadCandidateFile(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @RequestParam MultipartFile file) {
        return ResponseEntity.ok(candidateFileService.uploadCandidateFile(candidateId, loginId, file));
    }

    @GetMapping("/candidates/{candidateId}/files/{fileId}")
    public ResponseEntity<byte[]> downloadCandidateFile(
            @PathVariable String candidateId,
            @PathVariable Long fileId,
            @RequestParam String loginId) {
        Map<String, Object> raw = candidateFileService.getCandidateFileRaw(candidateId, fileId, loginId);
        byte[] data = (byte[]) raw.get("file_data");
        String name = (String) raw.get("file_name");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }

    @DeleteMapping("/candidates/{candidateId}/files/{fileId}")
    public ResponseEntity<Void> deleteCandidateFile(
            @PathVariable String candidateId,
            @PathVariable Long fileId,
            @RequestParam String loginId) {
        candidateFileService.deleteCandidateFile(candidateId, fileId, loginId);
        return ResponseEntity.noContent().build();
    }

    // ── Work Experience / Education (Phase 2A) ────────────────────────────────
    // GET auto-generates on first call and caches on the candidate row; POST
    // .../generate forces a fresh extraction (e.g. after the CV is updated).

    @GetMapping("/candidates/{candidateId}/experience")
    public CandidateExperienceResponse getExperience(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return candidateExperienceService.getExperience(candidateId, loginId);
    }

    @PostMapping("/candidates/{candidateId}/experience/generate")
    public CandidateExperienceResponse regenerateExperience(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return candidateExperienceService.getExperience(candidateId, loginId, true);
    }
}
