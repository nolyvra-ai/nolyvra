package com.nolyvra.app.controller;

import com.nolyvra.app.model.NexusThreadResponse;
import com.nolyvra.app.model.NexusThreadSummary;
import com.nolyvra.app.service.NexusMessagingService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// Read-only endpoints backing the recruiter's Nexus Messages tab — new in v0.6,
// once Nexus added a service-token-authenticated read path for threads/messages.
// Sending a message still goes through NexusSearchController's existing
// /api/talent-search/nexus-blend/message endpoint (unchanged, reused as-is).
@RestController
@RequestMapping("/api/nexus-messaging")
public class NexusMessagingController {

    private final NexusMessagingService nexusMessagingService;

    public NexusMessagingController(NexusMessagingService nexusMessagingService) {
        this.nexusMessagingService = nexusMessagingService;
    }

    @GetMapping("/threads")
    public List<NexusThreadSummary> listThreads(@RequestParam String loginId) {
        return nexusMessagingService.listThreads(loginId);
    }

    @GetMapping("/threads/{threadId}/messages")
    public List<NexusThreadResponse> getThreadMessages(
            @PathVariable String threadId,
            @RequestParam String loginId) {
        return nexusMessagingService.getThreadMessages(threadId, loginId);
    }
}
