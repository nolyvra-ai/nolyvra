package com.nolyvra.app.service;

import com.nolyvra.app.model.NexusConsentRequest;
import com.nolyvra.app.model.NexusPhoneRevealResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NexusConsentServiceTest {

    private final NexusClient nexusClient = mock(NexusClient.class);
    private final NexusConsentService service = new NexusConsentService(nexusClient);

    @Test
    void revealPhoneReturnsThePhoneOnSuccess() {
        when(nexusClient.isConfigured()).thenReturn(true);
        when(nexusClient.revealPhone(any(NexusConsentRequest.class)))
                .thenReturn(new NexusPhoneRevealResponse("+61 400 000 000"));

        NexusPhoneRevealResponse response = service.revealPhone("nexus-candidate-1", "login-1");

        assertThat(response.phone()).isEqualTo("+61 400 000 000");
    }

    @Test
    void revealPhoneTranslatesNexus403IntoAResponseStatusException403() {
        when(nexusClient.isConfigured()).thenReturn(true);
        HttpClientErrorException forbidden = HttpClientErrorException.create(
                HttpStatus.FORBIDDEN, "Forbidden", HttpHeaders.EMPTY, new byte[0], null);
        when(nexusClient.revealPhone(any(NexusConsentRequest.class))).thenThrow(forbidden);

        assertThatThrownBy(() -> service.revealPhone("nexus-candidate-1", "login-1"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void revealPhoneLetsOtherExceptionsPropagateUncaught() {
        when(nexusClient.isConfigured()).thenReturn(true);
        when(nexusClient.revealPhone(any(NexusConsentRequest.class)))
                .thenThrow(new RuntimeException("connection timed out"));

        assertThatThrownBy(() -> service.revealPhone("nexus-candidate-1", "login-1"))
                .isInstanceOf(RuntimeException.class)
                .isNotInstanceOf(ResponseStatusException.class);
    }

    @Test
    void revealPhoneThrowsACleanServiceUnavailableWhenNexusIsDisabled() {
        when(nexusClient.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.revealPhone("nexus-candidate-1", "login-1"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    @Test
    void requestConsentThrowsACleanServiceUnavailableWhenNexusIsDisabled() {
        when(nexusClient.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.requestConsent("nexus-candidate-1", "login-1"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }
}
