package com.nolyvra.app.controller;

import com.nolyvra.app.model.InterviewResponse;
import com.nolyvra.app.model.InterviewScheduleRequest;
import com.nolyvra.app.service.InterviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/interviews")
public class InterviewController {

    private final InterviewService interviewService;

    public InterviewController(InterviewService interviewService) {
        this.interviewService = interviewService;
    }

    @PostMapping("/schedule")
    public InterviewResponse scheduleInterview(
            @Valid @RequestBody InterviewScheduleRequest req,
            @RequestParam String loginId) {
        try {
            return interviewService.scheduleInterview(req, loginId);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    @GetMapping
    public List<InterviewResponse> getScheduledInterviews(@RequestParam String loginId) {
        return interviewService.getScheduledInterviews(loginId);
    }

    @GetMapping("/candidate/{candidateId}")
    public List<InterviewResponse> getInterviewsForCandidate(
            @PathVariable String candidateId,
            @RequestParam String loginId) {
        return interviewService.getInterviewsForCandidate(candidateId, loginId);
    }

    // ── Check for scheduling conflict before submitting the form ─────────────
    // Returns { conflict: true/false, message: "..." }
    @GetMapping("/check-conflict")
    public Map<String, Object> checkConflict(
            @RequestParam String candidateId,
            @RequestParam String scheduledAt,
            @RequestParam(defaultValue = "60") int durationMinutes,
            @RequestParam String loginId) {
        try {
            OffsetDateTime dt = OffsetDateTime.ofInstant(
                    Instant.parse(scheduledAt), ZoneOffset.UTC);
            boolean conflict = interviewService.hasConflict(
                    loginId, dt, durationMinutes, null);
            return Map.of(
                    "conflict", conflict,
                    "message", conflict
                            ? "This time slot is already booked. Please choose a different time."
                            : "");
        } catch (Exception e) {
            return Map.of("conflict", false, "message", "");
        }
    }

    @PatchMapping("/{interviewId}/cancel")
    public Map<String, String> cancelInterview(
            @PathVariable String interviewId,
            @RequestParam String loginId) {
        boolean cancelled = interviewService.cancelInterview(interviewId, loginId);
        if (!cancelled) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Interview not found: " + interviewId);
        }
        return Map.of("status", "cancelled");
    }
}