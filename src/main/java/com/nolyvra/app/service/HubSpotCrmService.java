package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.Map;
import java.util.List;

@Service
public class HubSpotCrmService {

    private static final Logger log = LoggerFactory.getLogger(HubSpotCrmService.class);

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

    public RemoteObject getCompanyForSync(String loginId, String companyId) throws Exception {
        return mapRemoteObject(sendJson(
                loginId, "GET",
                "/companies/" + companyId + "?properties=name,description,linkedin_company_page",
                null));
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

    public RemoteObject getContactForSync(String loginId, String contactId) throws Exception {
        return mapRemoteObject(sendJson(
                loginId, "GET",
                "/contacts/" + contactId + "?properties=email,firstname,lastname,phone,jobtitle",
                null));
    }

    public CrmObject createDeal(String loginId, Map<String, String> properties) throws Exception {
        return mapObject(sendJson(
                loginId, "POST", "/deals", Map.of("properties", properties)));
    }

    public CrmObject updateDeal(
            String loginId, String dealId, Map<String, String> properties) throws Exception {
        return mapObject(sendJson(
                loginId, "PATCH", "/deals/" + dealId, Map.of("properties", properties)));
    }

    public JsonNode getDeal(String loginId, String dealId) throws Exception {
        return sendJson(loginId, "GET", "/deals/" + dealId, null);
    }

    public RemoteObject getDealForSync(String loginId, String dealId) throws Exception {
        return mapRemoteObject(sendJson(
                loginId, "GET",
                "/deals/" + dealId + "?properties=dealname,amount,pipeline,dealstage",
                null));
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

    public void associateContactToCompany(
            String loginId, String contactId, String companyId) throws Exception {
        sendJson(loginId, "PUT",
                "/contact/" + contactId + "/associations/default/company/" + companyId,
                null);
    }

    public void associateDealToCompany(
            String loginId, String dealId, String companyId) throws Exception {
        sendJson(loginId, "PUT",
                "/deal/" + dealId + "/associations/default/company/" + companyId,
                null);
    }

    public void associateDealToContact(
            String loginId, String dealId, String contactId) throws Exception {
        sendJson(loginId, "PUT",
                "/deal/" + dealId + "/associations/default/contact/" + contactId,
                null);
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
        String category = json.path("category").asText(null);
        String correlationId = json.path("correlationId").asText(null);
        HttpHeaders headers = response.headers();
        String retryAfter = headers == null ? null : headers.firstValue("Retry-After").orElse(null);
        log.info("[HubSpotCRM] method={} path={} objectType={} status={} category={} correlationId={} retryAfter={}",
                method, path, objectType(path), response.statusCode(), category, correlationId, retryAfter);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String message = json.path("message").asText("HubSpot API request failed");
            log.warn("[HubSpotCRM] request failed method={} path={} status={} category={} correlationId={} retryAfter={}",
                    method, path, response.statusCode(), category, correlationId, retryAfter);
            throw new HubSpotApiException(
                    response.statusCode(), message, category, correlationId, retryAfter);
        }
        return json;
    }

    private String objectType(String path) {
        if (path == null || path.isBlank()) return "unknown";
        String normalized = path.startsWith("/") ? path.substring(1) : path;
        String first = normalized.split("/", 2)[0];
        return switch (first) {
            case "company", "companies" -> "company";
            case "contact", "contacts" -> "contact";
            case "deal", "deals" -> "deal";
            default -> first == null || first.isBlank() ? "unknown" : first;
        };
    }

    private CrmObject mapObject(JsonNode response) {
        String id = response.path("id").asText();
        if (id.isBlank()) {
            throw new HubSpotApiException(502, "HubSpot response did not include an object ID");
        }
        return new CrmObject(id, response.path("url").asText(null));
    }

    private RemoteObject mapRemoteObject(JsonNode response) {
        CrmObject object = mapObject(response);
        String updatedAtText = response.path("updatedAt").asText(null);
        Instant updatedAt = updatedAtText == null || updatedAtText.isBlank()
                ? null
                : Instant.parse(updatedAtText);
        JsonNode properties = response.path("properties");
        return new RemoteObject(object.id(), object.url(), updatedAt, properties);
    }

    public record CrmObject(String id, String url) {}
    public record RemoteObject(String id, String url, Instant updatedAt, JsonNode properties) {}

    public static class HubSpotNotConnectedException extends RuntimeException {
        public HubSpotNotConnectedException() {
            super("HubSpot is not connected");
        }
    }

    public static class HubSpotApiException extends RuntimeException {
        private final int statusCode;
        private final String category;
        private final String correlationId;
        private final String retryAfter;

        public HubSpotApiException(int statusCode, String message) {
            this(statusCode, message, null, null, null);
        }

        public HubSpotApiException(
                int statusCode,
                String message,
                String category,
                String correlationId,
                String retryAfter) {
            super(message);
            this.statusCode = statusCode;
            this.category = category;
            this.correlationId = correlationId;
            this.retryAfter = retryAfter;
        }

        public int getStatusCode() {
            return statusCode;
        }

        public String getCategory() {
            return category;
        }

        public String getCorrelationId() {
            return correlationId;
        }

        public String getRetryAfter() {
            return retryAfter;
        }
    }
}
