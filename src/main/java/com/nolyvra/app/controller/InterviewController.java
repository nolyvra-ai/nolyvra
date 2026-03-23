package com.nolyvra.app.controller;

import com.nolyvra.app.model.InterviewResponse;
import com.nolyvra.app.model.InterviewScheduleRequest;
import com.nolyvra.app.service.InterviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
        return interviewService.scheduleInterview(req, loginId);
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
