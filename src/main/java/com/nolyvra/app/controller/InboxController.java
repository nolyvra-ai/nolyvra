package com.nolyvra.app.controller;

import com.nolyvra.app.model.EmailHistoryResponse;
import com.nolyvra.app.model.InboxPageResponse;
import com.nolyvra.app.model.InboxReplyRequest;
import com.nolyvra.app.model.InboxThreadResponse;
import com.nolyvra.app.model.TemplateSuggestionRequest;
import com.nolyvra.app.model.TemplateSuggestionResponse;
import com.nolyvra.app.service.InboxService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

// Live inbox proxy for Email Centre — every GET here calls Outlook/Gmail
// directly (see InboxService); nothing is stored except the reply send,
// which reuses the existing /api/emails/send path and its email_history log.
@RestController
@RequestMapping("/api/inbox")
public class InboxController {

    private final InboxService inboxService;

    public InboxController(InboxService inboxService) {
        this.inboxService = inboxService;
    }

    @GetMapping("/messages")
    public InboxPageResponse listMessages(
            @RequestParam String loginId,
            @RequestParam String provider,
            @RequestParam(defaultValue = "false") boolean unread,
            @RequestParam(required = false) String pageToken,
            @RequestParam(defaultValue = "20") int pageSize) {
        return inboxService.listMessages(loginId, provider, unread, pageToken, pageSize);
    }

    @GetMapping("/threads/{threadId}")
    public InboxThreadResponse getThread(
            @PathVariable String threadId,
            @RequestParam String loginId,
            @RequestParam String provider) {
        return inboxService.getThread(loginId, provider, threadId);
    }

    @PatchMapping("/messages/{messageId}/read")
    public void markRead(
            @PathVariable String messageId,
            @RequestParam String loginId,
            @RequestParam String provider,
            @RequestParam(defaultValue = "true") boolean read) {
        inboxService.markRead(loginId, provider, messageId, read);
    }

    @PostMapping("/messages/{messageId}/archive")
    public void archive(
            @PathVariable String messageId,
            @RequestParam String loginId,
            @RequestParam String provider) {
        inboxService.archive(loginId, provider, messageId);
    }

    @PostMapping("/reply")
    public EmailHistoryResponse reply(
            @Valid @RequestBody InboxReplyRequest req,
            @RequestParam String loginId) {
        return inboxService.reply(req, loginId);
    }

    @PostMapping("/templates/suggest")
    public TemplateSuggestionResponse suggestTemplates(
            @Valid @RequestBody TemplateSuggestionRequest req,
            @RequestParam String loginId) {
        return inboxService.suggestTemplates(loginId, req.messageBody());
    }
}
