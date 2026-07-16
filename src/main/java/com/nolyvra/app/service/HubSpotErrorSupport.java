package com.nolyvra.app.service;

import org.springframework.http.HttpStatus;

final class HubSpotErrorSupport {

    private HubSpotErrorSupport() {
    }

    static HttpStatus responseStatus(Throwable error) {
        if (error instanceof HubSpotOAuthService.HubSpotReconnectRequiredException) {
            return HttpStatus.CONFLICT;
        }
        if (error instanceof HubSpotCrmService.HubSpotApiException apiError
                && apiError.getStatusCode() == 429) {
            return HttpStatus.TOO_MANY_REQUESTS;
        }
        return HttpStatus.BAD_GATEWAY;
    }

    static String userMessage(Throwable error) {
        if (error instanceof HubSpotOAuthService.HubSpotReconnectRequiredException) {
            return "HubSpot reconnect required. Reconnect HubSpot in Settings and try again.";
        }
        if (error instanceof HubSpotCrmService.HubSpotNotConnectedException) {
            return "Connect HubSpot in Settings before syncing.";
        }
        if (error instanceof HubSpotCrmService.HubSpotApiException apiError) {
            return apiMessage(apiError);
        }
        String message = error.getMessage();
        if (message == null || message.isBlank()) {
            return "HubSpot sync failed. Please try again.";
        }
        return truncate(message);
    }

    private static String apiMessage(HubSpotCrmService.HubSpotApiException error) {
        int status = error.getStatusCode();
        if (status == 429) {
            String retry = error.getRetryAfter() == null || error.getRetryAfter().isBlank()
                    ? ""
                    : " Retry after " + error.getRetryAfter() + "ms.";
            return "HubSpot rate limit reached." + retry;
        }
        if (status == 401 || status == 403) {
            return "HubSpot authorization failed. Reconnect HubSpot in Settings and try again.";
        }
        if (status >= 500) {
            return "HubSpot is temporarily unavailable. Please try again later.";
        }
        String message = error.getMessage();
        if (message == null || message.isBlank()) {
            return "HubSpot rejected the sync request.";
        }
        return truncate(message);
    }

    private static String truncate(String message) {
        return message.length() > 500 ? message.substring(0, 500) : message;
    }
}
