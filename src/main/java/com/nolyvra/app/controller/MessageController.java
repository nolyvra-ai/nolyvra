package com.nolyvra.app.controller;

import com.nolyvra.app.model.MessageGenerateRequest;
import com.nolyvra.app.model.MessageGenerateResponse;
import com.nolyvra.app.service.MessageService;
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
