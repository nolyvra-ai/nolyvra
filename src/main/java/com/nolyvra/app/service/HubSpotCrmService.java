package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.List;

@Service
public class HubSpotCrmService {

    private static final String OBJECTS_URL = "https://api.hubapi.com/crm/objects/2026-03";

    private final HubSpotOAuthService oauthService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Autowired
    public HubSpotCrmService(HubSpotOAuthService oauthService, ObjectMapper objectMapper) {
        this(oauthService, objectMapper, HttpClient.newHttpClient());
    }

    HubSpotCrmService(
            HubSpotOAuthService oauthService, ObjectMapper objectMapper, HttpClient httpClient) {
        this.oauthService = oauthService;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    public CrmObject createCompany(String loginId, Map<String, String> properties) throws Exception {
        JsonNode response = sendJson(
                loginId, "POST", "/companies", Map.of("properties", properties));
        return mapObject(response);
    }

    public CrmObject updateCompany(
            String loginId, String companyId, Map<String, String> properties) throws Exception {
        JsonNode response = sendJson(
                loginId, "PATCH", "/companies/" + companyId, Map.of("properties", properties));
        return mapObject(response);
    }

    public JsonNode getCompany(String loginId, String companyId) throws Exception {
        return sendJson(loginId, "GET", "/companies/" + companyId, null);
    }

    public CrmObject createContact(String loginId, Map<String, String> properties) throws Exception {
        return mapObject(sendJson(
                loginId, "POST", "/contacts", Map.of("properties", properties)));
    }

    public CrmObject updateContact(
            String loginId, String contactId, Map<String, String> properties) throws Exception {
        return mapObject(sendJson(
                loginId, "PATCH", "/contacts/" + contactId, Map.of("properties", properties)));
    }

    public CrmObject findContactByEmail(String loginId, String email) throws Exception {
        Map<String, Object> filter = Map.of(
                "propertyName", "email", "operator", "EQ", "value", email);
        Map<String, Object> body = Map.of(
                "filterGroups", List.of(Map.of("filters", List.of(filter))),
                "properties", List.of("email"),
                "limit", 1);
        JsonNode response = sendJson(loginId, "POST", "/contacts/search", body);
        JsonNode results = response.path("results");
        return results.isArray() && !results.isEmpty() ? mapObject(results.get(0)) : null;
    }

    private JsonNode sendJson(String loginId, String method, String path, Object body) throws Exception {
        String accessToken = oauthService.getValidAccessToken(loginId);
        if (accessToken == null || accessToken.isBlank()) {
            throw new HubSpotNotConnectedException();
        }

        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(OBJECTS_URL + path))
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/json");
        if (body == null) {
            request.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            request.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(body)));
        }

        HttpResponse<String> response = httpClient.send(
                request.build(), HttpResponse.BodyHandlers.ofString());
        JsonNode json = response.body() == null || response.body().isBlank()
                ? objectMapper.createObjectNode()
                : objectMapper.readTree(response.body());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String message = json.path("message").asText("HubSpot API request failed");
            throw new HubSpotApiException(response.statusCode(), message);
        }
        return json;
    }

    private CrmObject mapObject(JsonNode response) {
        String id = response.path("id").asText();
        if (id.isBlank()) {
            throw new HubSpotApiException(502, "HubSpot response did not include an object ID");
        }
        return new CrmObject(id, response.path("url").asText(null));
    }

    public record CrmObject(String id, String url) {}

    public static class HubSpotNotConnectedException extends RuntimeException {
        public HubSpotNotConnectedException() {
            super("HubSpot is not connected");
        }
    }

    public static class HubSpotApiException extends RuntimeException {
        private final int statusCode;

        public HubSpotApiException(int statusCode, String message) {
            super(message);
            this.statusCode = statusCode;
        }

        public int getStatusCode() {
            return statusCode;
        }
    }
}
