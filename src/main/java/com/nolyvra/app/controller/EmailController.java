package com.nolyvra.app.controller;

import com.nolyvra.app.model.EmailHistoryResponse;
import com.nolyvra.app.model.EmailSendRequest;
import com.nolyvra.app.model.EmailTemplateResponse;
import com.nolyvra.app.service.EmailService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/emails")
public class EmailController {

    private final EmailService emailService;

    public EmailController(EmailService emailService) {
        this.emailService = emailService;
    }

    @PostMapping("/send")
    public EmailHistoryResponse sendEmail(
            @Valid @RequestBody EmailSendRequest req,
            @RequestParam String loginId) {
        return emailService.sendEmail(req, loginId);
    }

    @GetMapping("/history")
    public List<EmailHistoryResponse> getEmailHistory(
            @RequestParam String loginId,
            @RequestParam(required = false) String candidateId) {
        return emailService.getEmailHistory(loginId, candidateId);
    }

    @GetMapping("/templates")
    public List<EmailTemplateResponse> getTemplates(@RequestParam String loginId) {
        return emailService.getTemplates(loginId);
    }
}
