package com.nolyvra.app.service;

import com.nolyvra.app.model.NexusConsentRequest;
import com.nolyvra.app.model.NexusMessageRequest;
import com.nolyvra.app.model.NexusPhoneRevealResponse;
import com.nolyvra.app.model.NexusSearchRequest;
import com.nolyvra.app.model.NexusSearchResponse;
import com.nolyvra.app.model.NexusThreadResponse;
import com.nolyvra.app.model.NexusThreadSummary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.util.List;

// Client for the Nolyvra Nexus integration surface — see docs/nexus-integration/shared-contracts.md
//
// TEMPORARY DEBUG LOGGING (Sayan, 2026-07-24): added throughout to diagnose why
// no data was coming back from Nexus. Deliberately never logs: the service-token
// or signature values, message body text (recruiter-written, potentially
// sensitive), or a revealed phone number — only request/response metadata and
// error detail (HTTP status + Nexus's own error body, which never contains our
// candidate PII since we never send any).
@Service
public class NexusClient {

    private static final String SEARCH_PATH          = "/api/v1/search/candidates";
    private static final String MESSAGING_PATH        = "/api/v1/messaging/threads";
    private static final String CONSENT_REQUEST_PATH  = "/api/v1/consent/requests";
    private static final String PHONE_REVEAL_PATH      = "/api/v1/consent/phone-reveal";
    private static final String INTEGRATION_EVENTS_PATH = "/api/v1/integration/events";

    private final RestTemplate restTemplate;
    private final boolean enabled;
    private final String baseUrl;
    private final String serviceToken;

    public NexusClient(
            RestTemplateBuilder restTemplateBuilder,
            @Value("${nexus.enabled:false}") boolean enabled,
            @Value("${nexus.base-url:}") String baseUrl,
            @Value("${nexus.service-token:}") String serviceToken) {
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(10))
                .build();
        this.enabled = enabled;
        this.baseUrl = baseUrl;
        this.serviceToken = serviceToken;
        System.out.println("[NexusClient] init — enabled=" + enabled
                + " baseUrl=" + (baseUrl == null || baseUrl.isBlank() ? "NOT SET" : baseUrl)
                + " serviceToken=" + (serviceToken == null || serviceToken.isBlank() ? "NOT SET" : "SET"));
    }

    // True once the feature toggle is on AND both the base URL and service token
    // are configured — callers should skip the Nexus call gracefully (not error)
    // when this is false. Single gate for the whole integration (2026-07-26).
    public boolean isConfigured() {
        return enabled && baseUrl != null && !baseUrl.isBlank() && serviceToken != null && !serviceToken.isBlank();
    }

    public NexusSearchResponse searchCandidates(NexusSearchRequest request) {
        System.out.println("[NexusClient] POST " + baseUrl + SEARCH_PATH
                + " jdText=\"" + request.jdText() + "\" skills=" + request.skills()
                + " location=" + request.location() + " tenantRef=" + request.tenantRef()
                + " page=" + request.page() + " pageSize=" + request.pageSize());
        try {
            NexusSearchResponse response = restTemplate.postForObject(
                    baseUrl + SEARCH_PATH, entity(request), NexusSearchResponse.class);
            int count = response != null && response.results() != null ? response.results().size() : 0;
            System.out.println("[NexusClient] search response: " + count + " result(s)"
                    + (response != null ? " scoreBreakdownRef=" + response.scoreBreakdownRef() : " (null response body)"));
            // identityToken is a one-way hash, safe to log — this is what lets you compare
            // "what identityToken did we queue in an outbound pipeline event for candidate X"
            // against "what identityToken does Nexus return for candidate X in search" —
            // a mismatch there means Nexus's identityToken lookup will never match on the
            // event, which acks 200 and silently drops it (expected per contract, not an error).
            if (response != null && response.results() != null) {
                response.results().forEach(r -> System.out.println("[NexusClient]   result candidateId="
                        + r.candidateId() + " displayName=" + r.displayName() + " identityToken=" + r.identityToken()
                        + " pipelineActivity=" + r.pipelineActivity()));
            }
            return response;
        } catch (Exception e) {
            System.err.println("[NexusClient] search failed: " + describeError(e));
            throw e;
        }
    }

    public NexusThreadResponse sendMessage(NexusMessageRequest request) {
        System.out.println("[NexusClient] POST " + baseUrl + MESSAGING_PATH
                + " candidateId=" + request.candidateId() + " recruiterRef=" + request.recruiterRef()
                + " tenantRef=" + request.tenantRef() + " bodyLength=" + safeLength(request.body()));
        try {
            NexusThreadResponse response = restTemplate.postForObject(
                    baseUrl + MESSAGING_PATH, entity(request), NexusThreadResponse.class);
            System.out.println("[NexusClient] sendMessage response: threadId=" + (response != null ? response.id() : "null"));
            return response;
        } catch (Exception e) {
            System.err.println("[NexusClient] sendMessage failed: " + describeError(e));
            throw e;
        }
    }

    public void requestConsent(NexusConsentRequest request) {
        System.out.println("[NexusClient] POST " + baseUrl + CONSENT_REQUEST_PATH
                + " candidateId=" + request.candidateId() + " recruiterRef=" + request.recruiterRef()
                + " tenantRef=" + request.tenantRef());
        try {
            restTemplate.postForEntity(baseUrl + CONSENT_REQUEST_PATH, entity(request), Void.class);
            System.out.println("[NexusClient] requestConsent succeeded");
        } catch (Exception e) {
            System.err.println("[NexusClient] requestConsent failed: " + describeError(e));
            throw e;
        }
    }

    // 403 (no active grant) propagates as HttpClientErrorException.Forbidden — callers
    // must call this fresh every time and never cache the result (per contract).
    public NexusPhoneRevealResponse revealPhone(NexusConsentRequest request) {
        System.out.println("[NexusClient] POST " + baseUrl + PHONE_REVEAL_PATH
                + " candidateId=" + request.candidateId() + " recruiterRef=" + request.recruiterRef()
                + " tenantRef=" + request.tenantRef());
        try {
            NexusPhoneRevealResponse response = restTemplate.postForObject(
                    baseUrl + PHONE_REVEAL_PATH, entity(request), NexusPhoneRevealResponse.class);
            // Never logging the number itself — only whether it actually came through.
            // If this shows present=false on a 200 response, that's evidence of a field
            // shape/name mismatch between what Nexus sent and what we deserialized into
            // (NexusPhoneRevealResponse expects a JSON field literally named "phone"),
            // not a frontend bug — worth taking straight back to the Nexus side.
            boolean present = response != null && response.phone() != null && !response.phone().isBlank();
            System.out.println("[NexusClient] revealPhone succeeded — phone field present=" + present
                    + (present ? ", length=" + response.phone().length() : "") + " (value itself never logged)");
            return response;
        } catch (HttpStatusCodeException e) {
            // 403 here is the expected, common "no grant yet" case, not a real error —
            // log at info level, not as an alarming failure.
            System.out.println("[NexusClient] revealPhone: HTTP " + e.getStatusCode()
                    + (e.getStatusCode().value() == 403 ? " (no active grant — expected)" : " " + e.getResponseBodyAsString()));
            throw e;
        } catch (Exception e) {
            System.err.println("[NexusClient] revealPhone failed: " + describeError(e));
            throw e;
        }
    }

    // GET /api/v1/messaging/threads?recruiterRef= (v0.6) — every thread for one recruiter.
    public List<NexusThreadSummary> listThreads(String recruiterRef) {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + MESSAGING_PATH)
                .queryParam("recruiterRef", recruiterRef)
                .build().encode().toUri();
        System.out.println("[NexusClient] GET " + uri);
        try {
            List<NexusThreadSummary> response = restTemplate.exchange(
                    uri, HttpMethod.GET, noBodyEntity(), new ParameterizedTypeReference<List<NexusThreadSummary>>() {}
            ).getBody();
            System.out.println("[NexusClient] listThreads response: " + (response != null ? response.size() : 0) + " thread(s)");
            return response;
        } catch (Exception e) {
            System.err.println("[NexusClient] listThreads failed: " + describeError(e));
            throw e;
        }
    }

    // GET /api/v1/messaging/threads/{threadId}/messages?recruiterRef= (v0.6) — full
    // history for one thread; 404 if it belongs to a different recruiterRef.
    public List<NexusThreadResponse> getThreadMessages(String threadId, String recruiterRef) {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + MESSAGING_PATH + "/" + threadId + "/messages")
                .queryParam("recruiterRef", recruiterRef)
                .build().encode().toUri();
        System.out.println("[NexusClient] GET " + uri);
        try {
            List<NexusThreadResponse> response = restTemplate.exchange(
                    uri, HttpMethod.GET, noBodyEntity(), new ParameterizedTypeReference<List<NexusThreadResponse>>() {}
            ).getBody();
            System.out.println("[NexusClient] getThreadMessages response: " + (response != null ? response.size() : 0) + " message(s) (content not logged)");
            return response;
        } catch (Exception e) {
            System.err.println("[NexusClient] getThreadMessages failed: " + describeError(e));
            throw e;
        }
    }

    // Outbound integration events (pipeline signals). Takes the exact raw JSON
    // bytes that were signed — must not be re-serialized here, or the bytes sent
    // could differ from the bytes signed (see the contract's own warning about
    // key-order/whitespace mismatches).
    public void postIntegrationEvent(byte[] rawJsonBody, String signature) {
        System.out.println("[NexusClient] POST " + baseUrl + INTEGRATION_EVENTS_PATH
                + " bodyBytes=" + rawJsonBody.length + " signaturePresent=" + (signature != null && !signature.isBlank()));
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Nolyvra-Service-Token", serviceToken);
            headers.set("X-Nolyvra-Signature", signature);
            HttpEntity<byte[]> entity = new HttpEntity<>(rawJsonBody, headers);
            restTemplate.postForEntity(baseUrl + INTEGRATION_EVENTS_PATH, entity, Void.class);
            System.out.println("[NexusClient] postIntegrationEvent succeeded");
        } catch (Exception e) {
            System.err.println("[NexusClient] postIntegrationEvent failed: " + describeError(e));
            throw e;
        }
    }

    private String describeError(Exception e) {
        if (e instanceof HttpStatusCodeException hsce) {
            return "HTTP " + hsce.getStatusCode() + " body=" + hsce.getResponseBodyAsString();
        }
        return e.getClass().getSimpleName() + ": " + e.getMessage();
    }

    private int safeLength(String s) {
        return s == null ? 0 : s.length();
    }

    private <T> HttpEntity<T> entity(T body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Nolyvra-Service-Token", serviceToken);
        return new HttpEntity<>(body, headers);
    }

    private HttpEntity<Void> noBodyEntity() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Nolyvra-Service-Token", serviceToken);
        return new HttpEntity<>(headers);
    }
}
