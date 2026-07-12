package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HubSpotCrmServiceTest {

    private final HubSpotOAuthService oauthService = mock(HubSpotOAuthService.class);
    private final HttpClient httpClient = mock(HttpClient.class);
    private final HubSpotCrmService service =
            new HubSpotCrmService(oauthService, new ObjectMapper(), httpClient);

    @Test
    void createCompanyUsesBearerTokenAndCurrentCompaniesEndpoint() throws Exception {
        HttpResponse<String> response = response(201, "{\"id\":\"company-123\",\"url\":\"https://hubspot.test/123\"}");
        when(oauthService.getValidAccessToken("login-1")).thenReturn("access-token");
        when(httpClient.send(any(), anyStringBodyHandler())).thenReturn(response);

        HubSpotCrmService.CrmObject result = service.createCompany(
                "login-1", Map.of("name", "Nolyvra"));

        ArgumentCaptor<HttpRequest> request = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(request.capture(), anyStringBodyHandler());
        assertThat(request.getValue().method()).isEqualTo("POST");
        assertThat(request.getValue().uri().toString())
                .isEqualTo("https://api.hubapi.com/crm/objects/2026-03/companies");
        assertThat(request.getValue().headers().firstValue("Authorization"))
                .contains("Bearer access-token");
        assertThat(result.id()).isEqualTo("company-123");
        assertThat(result.url()).isEqualTo("https://hubspot.test/123");
    }

    @Test
    void surfacesHubSpotErrorMessage() throws Exception {
        HttpResponse<String> response = response(400, "{\"message\":\"Invalid property\"}");
        when(oauthService.getValidAccessToken("login-1")).thenReturn("access-token");
        when(httpClient.send(any(), anyStringBodyHandler())).thenReturn(response);

        assertThatThrownBy(() -> service.updateCompany(
                "login-1", "company-123", Map.of("name", "Nolyvra")))
                .isInstanceOf(HubSpotCrmService.HubSpotApiException.class)
                .hasMessage("Invalid property");
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse.BodyHandler<String> anyStringBodyHandler() {
        return any(HttpResponse.BodyHandler.class);
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse<String> response(int status, String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        return response;
    }
}
