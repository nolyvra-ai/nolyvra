package com.nolyvra.app.service;

import com.nolyvra.app.model.NexusMessageRequest;
import com.nolyvra.app.model.NexusThreadResponse;
import com.nolyvra.app.model.NexusThreadSummary;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

// Thin wrapper over NexusClient.sendMessage() — no persistence. POST
// /api/v1/messaging/threads is idempotent server-side (Nexus finds-or-creates the
// thread keyed on candidateId+recruiterRef), so the ATS doesn't need to track
// threadId to support sending a follow-up — every send is just candidateId+
// recruiterRef+body again. See docs/nexus-integration/shared-contracts.md.
@Service
public class NexusMessagingService {

    private final NexusClient nexusClient;

    public NexusMessagingService(NexusClient nexusClient) {
        this.nexusClient = nexusClient;
    }

    // Deliberately no try/catch here — unlike search's graceful-degrade, a message
    // send is a user-initiated write; a failure must propagate as a real error to
    // the recruiter, not be silently swallowed. Disabled state is the one exception:
    // a clean 503 beats a raw connection-refused exception reaching the frontend.
    public NexusThreadResponse sendMessage(String nexusCandidateId, String body, String loginId) {
        if (!nexusClient.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Nexus messaging is currently disabled");
        }
        return nexusClient.sendMessage(new NexusMessageRequest(nexusCandidateId, loginId, loginId, body));
    }

    // Both reads are stateless pass-throughs, fetched fresh on every call — no local
    // persistence (v0.6: message content has no revocation concept, so caching
    // wouldn't violate anything, but nothing in this sprint has needed local storage
    // so far and this doesn't either — one less thing to keep in sync). Reads degrade
    // to an empty list when disabled (2026-07-26) — matches search's own
    // graceful-degrade pattern; the Messages page just shows "no conversations"
    // rather than an error while the feature is off.
    public List<NexusThreadSummary> listThreads(String loginId) {
        return nexusClient.isConfigured() ? nexusClient.listThreads(loginId) : List.of();
    }

    public List<NexusThreadResponse> getThreadMessages(String threadId, String loginId) {
        return nexusClient.isConfigured() ? nexusClient.getThreadMessages(threadId, loginId) : List.of();
    }
}
