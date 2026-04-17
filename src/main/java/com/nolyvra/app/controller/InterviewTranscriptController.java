package com.nolyvra.app.controller;

import com.nolyvra.app.model.InterviewTranscriptResponse;
import com.nolyvra.app.model.ManualTranscriptRequest;
import com.nolyvra.app.service.InterviewTranscriptService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/candidates/{candidateId}/interview-analysis")
public class InterviewTranscriptController {

    private final InterviewTranscriptService service;

    public InterviewTranscriptController(InterviewTranscriptService service) {
        this.service = service;
    }

    // POST — submit transcript text, run OpenAI analysis, persist result
    @PostMapping
    public ResponseEntity<InterviewTranscriptResponse> analyse(
            @PathVariable String candidateId,
            @RequestParam String loginId,
            @RequestBody ManualTranscriptRequest req) {

        if (req.transcriptText() == null || req.transcriptText().isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        InterviewTranscriptResponse result = service.analyseTranscript(
                candidateId, loginId,
                req.interviewId(),
                req.transcriptText());

        return ResponseEntity.ok(result);
    }

    // GET — all interview analyses for this candidate (latest first)
    @GetMapping
    public ResponseEntity<List<InterviewTranscriptResponse>> getAll(
            @PathVariable String candidateId,
            @RequestParam String loginId) {

        return ResponseEntity.ok(service.getAllForCandidate(candidateId, loginId));
    }
}
