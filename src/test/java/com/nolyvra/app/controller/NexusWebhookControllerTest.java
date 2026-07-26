package com.nolyvra.app.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.service.NexusInboundEventService;
import com.nolyvra.app.service.WebhookSignatureService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class NexusWebhookControllerTest {

    private static final byte[] VALID_BODY = ("{\"eventId\":\"11111111-1111-1111-1111-111111111111\","
            + "\"eventType\":\"message.received\"}").getBytes(StandardCharsets.UTF_8);

    private final WebhookSignatureService webhookSignatureService = mock(WebhookSignatureService.class);
    private final NexusInboundEventService nexusInboundEventService = mock(NexusInboundEventService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final NexusWebhookController controller =
            new NexusWebhookController(webhookSignatureService, nexusInboundEventService, objectMapper);

    @Test
    void rejectsAnInvalidSignatureBeforeParsingOrRecordingAnything() {
        when(webhookSignatureService.verify(VALID_BODY, "bad-sig")).thenReturn(false);

        assertThatThrownBy(() -> controller.receiveWebhook(VALID_BODY, "bad-sig"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));

        verifyNoInteractions(nexusInboundEventService);
    }

    @Test
    void rejectsMalformedJsonEvenWithAValidSignature() {
        byte[] malformed = "not json".getBytes(StandardCharsets.UTF_8);
        when(webhookSignatureService.verify(malformed, "good-sig")).thenReturn(true);

        assertThatThrownBy(() -> controller.receiveWebhook(malformed, "good-sig"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void rejectsAPayloadMissingEventIdOrEventType() {
        byte[] incomplete = "{\"eventType\":\"message.received\"}".getBytes(StandardCharsets.UTF_8);
        when(webhookSignatureService.verify(incomplete, "good-sig")).thenReturn(true);

        assertThatThrownBy(() -> controller.receiveWebhook(incomplete, "good-sig"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void recordsTheEventOnceSignatureAndPayloadAreBothValid() {
        when(webhookSignatureService.verify(VALID_BODY, "good-sig")).thenReturn(true);

        controller.receiveWebhook(VALID_BODY, "good-sig");

        verify(nexusInboundEventService)
                .recordIfNew("11111111-1111-1111-1111-111111111111", "message.received");
    }
}
