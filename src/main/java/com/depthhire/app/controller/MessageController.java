package com.depthhire.app.controller;

import com.depthhire.app.model.MessageGenerateRequest;
import com.depthhire.app.model.MessageGenerateResponse;
import com.depthhire.app.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @PostMapping("/generate")
    public MessageGenerateResponse generateMessage(
            @Valid @RequestBody MessageGenerateRequest req,
            @RequestParam String loginId) {
        return messageService.generateMessage(req, loginId);
    }
}
