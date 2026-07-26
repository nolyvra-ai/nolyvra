package com.nolyvra.app.service;

import com.nolyvra.app.model.NexusMessageRequest;
import com.nolyvra.app.model.NexusThreadResponse;
import com.nolyvra.app.model.NexusThreadSummary;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NexusMessagingServiceTest {

    private final NexusClient nexusClient = mock(NexusClient.class);
    private final NexusMessagingService service = new NexusMessagingService(nexusClient);

    @Test
    void sendMessagePassesThroughWhenConfigured() {
        when(nexusClient.isConfigured()).thenReturn(true);
        when(nexusClient.sendMessage(any(NexusMessageRequest.class)))
                .thenReturn(new NexusThreadResponse("msg-1", "RECRUITER", "hello", Instant.now()));

        NexusThreadResponse response = service.sendMessage("nexus-candidate-1", "hello", "login-1");

        assertThat(response.id()).isEqualTo("msg-1");
    }

    @Test
    void sendMessageThrowsACleanServiceUnavailableWhenNexusIsDisabled() {
        when(nexusClient.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.sendMessage("nexus-candidate-1", "hello", "login-1"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    @Test
    void listThreadsReturnsEmptyListWhenNexusIsDisabledInsteadOfCallingOut() {
        when(nexusClient.isConfigured()).thenReturn(false);

        List<NexusThreadSummary> threads = service.listThreads("login-1");

        assertThat(threads).isEmpty();
    }

    @Test
    void getThreadMessagesReturnsEmptyListWhenNexusIsDisabledInsteadOfCallingOut() {
        when(nexusClient.isConfigured()).thenReturn(false);

        List<NexusThreadResponse> messages = service.getThreadMessages("thread-1", "login-1");

        assertThat(messages).isEmpty();
    }
}
