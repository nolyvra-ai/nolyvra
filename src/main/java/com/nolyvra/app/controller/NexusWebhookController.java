package com.nolyvra.app.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.service.NexusInboundEventService;
import com.nolyvra.app.service.WebhookSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

// Inbound Nexus webhook receiver — the URL configured as NOLYVRA_WEBHOOK_URL on
// the Nexus side. HMAC signature is the only auth in this direction (no
// service-token header expected), per docs/nexus-integration/shared-contracts.md.
// Verifies the signature over the exact raw request body BEFORE any parsing,
// dedupes by eventId. Durable recording only this step — see the Step 6 design
// note in .claude/sprint-context.md for why nothing is wired to any UI yet
// (Steps 4/5 are deliberately stateless, no persistence layer to notify through).
@RestController
@RequestMapping("/api/nexus")
public class NexusWebhookController {

    private final WebhookSignatureService webhookSignatureService;
    private final NexusInboundEventService nexusInboundEventService;
    private final ObjectMapper objectMapper;

    public NexusWebhookController(
            WebhookSignatureService webhookSignatureService,
            NexusInboundEventService nexusInboundEventService,
            ObjectMapper objectMapper) {
        this.webhookSignatureService = webhookSignatureService;
        this.nexusInboundEventService = nexusInboundEventService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/webhook")
    @ResponseStatus(HttpStatus.OK)
    public void receiveWebhook(
            @RequestBody byte[] rawBody,
            @RequestHeader("X-Nolyvra-Signature") String signature) {
        if (!webhookSignatureService.verify(rawBody, signature)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid signature");
        }
        JsonNode node;
        try {
            node = objectMapper.readTree(rawBody);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Malformed payload");
        }
        String eventId = node.path("eventId").asText(null);
        String eventType = node.path("eventType").asText(null);
        if (eventId == null || eventType == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing eventId/eventType");
        }
        nexusInboundEventService.recordIfNew(eventId, eventType);
    }
}
