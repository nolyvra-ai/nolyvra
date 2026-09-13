package com.nolyvra.app.controller;

import com.nolyvra.app.model.InterviewAnswerResponse;
import com.nolyvra.app.model.InterviewCompleteResponse;
import com.nolyvra.app.model.InterviewIntroResponse;
import com.nolyvra.app.service.InterviewSessionService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

// Candidate-facing, token-gated (no session/auth) audio interview endpoints.
// "/api/public/**" is already excluded from SessionInterceptor in
// WebMvcConfig — no auth config changes needed.
@RestController
@RequestMapping("/api/public/interview")
public class PublicInterviewController {

    private final InterviewSessionService interviewSessionService;

    public PublicInterviewController(InterviewSessionService interviewSessionService) {
        this.interviewSessionService = interviewSessionService;
    }

    @GetMapping("/{token}")
    public InterviewIntroResponse getIntro(@PathVariable String token) {
        return interviewSessionService.getIntro(token);
    }

    @PostMapping("/{token}/answers")
    public InterviewAnswerResponse submitAnswer(
            @PathVariable String token,
            @RequestParam int questionOrder,
            @RequestParam(required = false) Integer durationSecs,
            @RequestParam MultipartFile audio) {
        byte[] audioBytes;
        try {
            audioBytes = audio.getBytes();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read the recorded audio.");
        }
        return interviewSessionService.submitAnswer(token, questionOrder, audioBytes, audio.getContentType(), durationSecs);
    }

    @PostMapping("/{token}/complete")
    public InterviewCompleteResponse complete(@PathVariable String token) {
        return interviewSessionService.complete(token);
    }
}
