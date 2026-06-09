package com.nolyvra.app.controller;

import com.nolyvra.app.model.SmsHistoryResponse;
import com.nolyvra.app.model.SmsSendRequest;
import com.nolyvra.app.service.SmsService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sms")
public class SmsController {

    private final SmsService smsService;

    public SmsController(SmsService smsService) {
        this.smsService = smsService;
    }

    @PostMapping("/send")
    public SmsHistoryResponse sendSms(
            @Valid @RequestBody SmsSendRequest req,
            @RequestParam String loginId) {
        return smsService.sendSms(req, loginId);
    }

    @GetMapping("/history")
    public List<SmsHistoryResponse> getSmsHistory(
            @RequestParam String loginId,
            @RequestParam(required = false) String candidateId) {
        return smsService.getSmsHistory(loginId, candidateId);
    }
}
