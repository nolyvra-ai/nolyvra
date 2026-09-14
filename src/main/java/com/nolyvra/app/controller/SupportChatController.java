package com.nolyvra.app.controller;

import com.nolyvra.app.model.SupportChatRequest;
import com.nolyvra.app.model.SupportChatResponse;
import com.nolyvra.app.service.SupportChatService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/support-chat")
public class SupportChatController {

    private final SupportChatService supportChatService;

    public SupportChatController(SupportChatService supportChatService) {
        this.supportChatService = supportChatService;
    }

    // POST /api/support-chat?loginId=x
    @PostMapping
    public SupportChatResponse respond(
            @RequestParam String loginId,
            @RequestBody SupportChatRequest request) {
        return supportChatService.respond(loginId, request);
    }
}
