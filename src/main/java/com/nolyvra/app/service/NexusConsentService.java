package com.nolyvra.app.service;

import com.nolyvra.app.model.NexusConsentRequest;
import com.nolyvra.app.model.NexusPhoneRevealResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.server.ResponseStatusException;

// Thin wrapper over NexusClient's consent calls — no persistence, ephemeral on the
// frontend only. See docs/nexus-integration/shared-contracts.md: phone-reveal must be
// called fresh every time, never cached — a 403 here is the expected, common case
// ("no active grant yet"), not a failure.
@Service
public class NexusConsentService {

    private final NexusClient nexusClient;

    public NexusConsentService(NexusClient nexusClient) {
        this.nexusClient = nexusClient;
    }

    // No try/catch — a failed request should be a real error to the recruiter, same
    // as NexusMessagingService.sendMessage. Disabled state is the one exception: a
    // clean 503 beats a raw connection-refused exception reaching the frontend.
    public void requestConsent(String nexusCandidateId, String loginId) {
        if (!nexusClient.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Nexus consent is currently disabled");
        }
        nexusClient.requestConsent(new NexusConsentRequest(nexusCandidateId, loginId, loginId));
    }

    // 403 (no active grant) is expected and common — re-thrown as a clean
    // ResponseStatusException so it reaches the frontend as a real 403, not a generic
    // 500 (RestTemplate's HttpClientErrorException isn't one of the types Spring's
    // default exception handling preserves the status code for). Every other
    // exception propagates uncaught.
    public NexusPhoneRevealResponse revealPhone(String nexusCandidateId, String loginId) {
        if (!nexusClient.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Nexus consent is currently disabled");
        }
        try {
            return nexusClient.revealPhone(new NexusConsentRequest(nexusCandidateId, loginId, loginId));
        } catch (HttpClientErrorException.Forbidden e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No active consent grant");
        }
    }
}
