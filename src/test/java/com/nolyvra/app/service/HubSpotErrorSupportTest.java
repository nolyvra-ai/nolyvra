package com.nolyvra.app.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class HubSpotErrorSupportTest {

    @Test
    void mapsReconnectRequiredToConflictAndUserMessage() {
        HubSpotOAuthService.HubSpotReconnectRequiredException error =
                new HubSpotOAuthService.HubSpotReconnectRequiredException("login-1", null);

        assertThat(HubSpotErrorSupport.responseStatus(error)).isEqualTo(HttpStatus.CONFLICT);
        assertThat(HubSpotErrorSupport.userMessage(error))
                .isEqualTo("HubSpot reconnect required. Reconnect HubSpot in Settings and try again.");
    }

    @Test
    void mapsRateLimitToTooManyRequestsAndRetryHint() {
        HubSpotCrmService.HubSpotApiException error =
                new HubSpotCrmService.HubSpotApiException(
                        429, "Limit reached", "RATE_LIMIT", "corr-1", "1000");

        assertThat(HubSpotErrorSupport.responseStatus(error)).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(HubSpotErrorSupport.userMessage(error))
                .isEqualTo("HubSpot rate limit reached. Retry after 1000ms.");
    }

    @Test
    void mapsHubSpotServerErrorsToTemporaryUnavailableMessage() {
        HubSpotCrmService.HubSpotApiException error =
                new HubSpotCrmService.HubSpotApiException(503, "Service unavailable");

        assertThat(HubSpotErrorSupport.responseStatus(error)).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(HubSpotErrorSupport.userMessage(error))
                .isEqualTo("HubSpot is temporarily unavailable. Please try again later.");
    }
}
