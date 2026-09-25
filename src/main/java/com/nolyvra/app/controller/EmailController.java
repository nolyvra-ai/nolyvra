package com.nolyvra.app.controller;

import com.nolyvra.app.model.EmailHistoryResponse;
import com.nolyvra.app.model.EmailSendRequest;
import com.nolyvra.app.model.EmailTemplateResponse;
import com.nolyvra.app.model.ServiceRequestEmailRequest;
import com.nolyvra.app.service.EmailService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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

    @PostMapping("/service-request")
    public Map<String, Boolean> raiseServiceRequest(
            @Valid @RequestBody ServiceRequestEmailRequest req,
            @RequestParam String loginId) {
        boolean sent = emailService.sendServiceRequestEmail(req.name(), req.email(), req.comments(), loginId);
        return Map.of("success", sent);
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
