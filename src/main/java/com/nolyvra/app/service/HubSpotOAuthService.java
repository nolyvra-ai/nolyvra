package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.HubSpotConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class HubSpotOAuthService {

    private static final Logger log = LoggerFactory.getLogger(HubSpotOAuthService.class);

    private static final String AUTH_URL = "https://app.hubspot.com/oauth/authorize";
    private static final String TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
    private static final String TOKEN_INFO_URL = "https://api.hubapi.com/oauth/v1/access-tokens/";
    private static final String SCOPES = String.join(" ",
            "oauth",
            "crm.objects.contacts.read",
            "crm.objects.contacts.write",
            "crm.objects.companies.read",
            "crm.objects.companies.write",
            "crm.objects.deals.read",
            "crm.objects.deals.write");

    private static final long STATE_TTL_SECONDS = 600;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, StateEntry> pendingStates = new ConcurrentHashMap<>();
    private final Map<String, Object> refreshLocks = new ConcurrentHashMap<>();

    public HubSpotOAuthService(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            @Value("${hubspot.client-id:}") String clientId,
            @Value("${hubspot.client-secret:}") String clientSecret,
            @Value("${hubspot.redirect-uri:http://localhost:8080/auth/hubspot/callback}") String redirectUri) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    public String getAuthorizationUrl(String loginId) {
        String state = newState();
        pendingStates.put(state, new StateEntry(loginId, Instant.now().plusSeconds(STATE_TTL_SECONDS)));

        return AUTH_URL
                + "?client_id=" + enc(clientId)
                + "&scope=" + enc(SCOPES)
                + "&redirect_uri=" + enc(redirectUri)
                + "&state=" + enc(state);
    }

    public void exchangeCodeForToken(String code, String state) throws Exception {
        StateEntry entry = pendingStates.remove(state);
        if (entry == null || Instant.now().isAfter(entry.expiresAt())) {
            throw new IllegalStateException("Invalid or expired HubSpot OAuth state");
        }
        String loginId = entry.loginId();

        String body = "grant_type=authorization_code"
                + "&code=" + enc(code)
                + "&redirect_uri=" + enc(redirectUri)
                + "&client_id=" + enc(clientId)
                + "&client_secret=" + enc(clientSecret);

        JsonNode json = postForm(TOKEN_URL, body);
        String accessToken = json.path("access_token").asText();
        String refreshToken = json.path("refresh_token").asText(null);
        Instant expiresAt = Instant.now().plusSeconds(json.path("expires_in").asLong(1800));
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalStateException("HubSpot did not return an access token");
        }
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new IllegalStateException("HubSpot did not return a refresh token");
        }

        TokenMetadata metadata = fetchTokenMetadata(accessToken);
        upsertConnection(loginId, metadata.portalId(), metadata.portalName(), metadata.userEmail(),
                accessToken, refreshToken, expiresAt);
    }

    public HubSpotConnection getConnection(String loginId) {
        return jdbc.query("""
                select id, login_id, hubspot_portal_id, hubspot_portal_name, hubspot_user_email,
                       access_token, refresh_token, expires_at
                from hubspot_connection
                where login_id = ?
                """, rs -> {
            if (!rs.next()) return null;
            return mapRow(rs);
        }, loginId);
    }

    public void disconnect(String loginId) {
        jdbc.update("delete from hubspot_connection where login_id = ?", loginId);
    }

    public String getValidAccessToken(String loginId) throws Exception {
        HubSpotConnection connection = getConnection(loginId);
        if (connection == null) return null;

        boolean expiringSoon = Instant.now().isAfter(connection.expiresAt().minusSeconds(300));
        if (!expiringSoon) {
            return connection.accessToken();
        }

        Object lock = refreshLocks.computeIfAbsent(loginId, k -> new Object());
        synchronized (lock) {
            HubSpotConnection current = getConnection(loginId);
            if (current == null) return null;
            boolean stillExpiringSoon = Instant.now().isAfter(current.expiresAt().minusSeconds(300));
            if (!stillExpiringSoon) {
                return current.accessToken();
            }
            return doRefresh(current);
        }
    }

    private String doRefresh(HubSpotConnection connection) {
        String body = "grant_type=refresh_token"
                + "&refresh_token=" + enc(connection.refreshToken())
                + "&client_id=" + enc(clientId)
                + "&client_secret=" + enc(clientSecret);

        JsonNode json;
        try {
            json = postForm(TOKEN_URL, body);
        } catch (Exception e) {
            throw new HubSpotReconnectRequiredException(connection.loginId(), e);
        }

        String newAccess = json.path("access_token").asText();
        String newRefresh = json.path("refresh_token").asText(null);
        if (newAccess == null || newAccess.isBlank()) {
            throw new HubSpotReconnectRequiredException(connection.loginId(), null);
        }
        if (newRefresh == null || newRefresh.isBlank()) {
            newRefresh = connection.refreshToken();
        }
        Instant expiresAt = Instant.now().plusSeconds(json.path("expires_in").asLong(1800));

        TokenMetadata metadata;
        try {
            metadata = fetchTokenMetadata(newAccess);
        } catch (Exception e) {
            log.warn("[HubSpotOAuth] token metadata refresh failed for loginId={}: {}", connection.loginId(), e.getMessage());
            metadata = new TokenMetadata(connection.hubspotPortalId(),
                    connection.hubspotPortalName(), connection.hubspotUserEmail());
        }

        upsertConnection(connection.loginId(), metadata.portalId(), metadata.portalName(), metadata.userEmail(),
                newAccess, newRefresh, expiresAt);
        return newAccess;
    }

    private TokenMetadata fetchTokenMetadata(String accessToken) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_INFO_URL + enc(accessToken)))
                .GET()
                .build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        JsonNode json = objectMapper.readTree(res.body());
        if (res.statusCode() >= 400) {
            log.warn("[HubSpotOAuth] token metadata endpoint returned status={}", res.statusCode());
            throw new RuntimeException("HubSpot token metadata endpoint returned status " + res.statusCode());
        }

        String portalId = json.hasNonNull("hub_id")
                ? json.path("hub_id").asText()
                : json.path("hubId").asText(null);
        String portalName = json.hasNonNull("hub_domain")
                ? json.path("hub_domain").asText()
                : json.path("hubDomain").asText(null);
        String userEmail = json.hasNonNull("user")
                ? json.path("user").asText()
                : json.path("user_email").asText(null);

        return new TokenMetadata(portalId, portalName, userEmail);
    }

    private JsonNode postForm(String url, String formBody) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(formBody))
                .build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        JsonNode json = objectMapper.readTree(res.body());
        if (res.statusCode() >= 400) {
            log.warn("[HubSpotOAuth] token endpoint returned status={}", res.statusCode());
            throw new RuntimeException("HubSpot OAuth token endpoint returned status " + res.statusCode());
        }
        log.debug("[HubSpotOAuth] token endpoint status={} accessTokenReceived={} refreshTokenReceived={}",
                res.statusCode(),
                json.hasNonNull("access_token"),
                json.hasNonNull("refresh_token"));
        return json;
    }

    private void upsertConnection(String loginId, String portalId, String portalName, String userEmail,
                                  String accessToken, String refreshToken, Instant expiresAt) {
        jdbc.update("""
                insert into hubspot_connection
                    (login_id, hubspot_portal_id, hubspot_portal_name, hubspot_user_email,
                     access_token, refresh_token, expires_at)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict (login_id) do update set
                    hubspot_portal_id   = excluded.hubspot_portal_id,
                    hubspot_portal_name = excluded.hubspot_portal_name,
                    hubspot_user_email  = excluded.hubspot_user_email,
                    access_token        = excluded.access_token,
                    refresh_token       = excluded.refresh_token,
                    expires_at          = excluded.expires_at,
                    updated_at          = now()
                """, loginId, portalId, portalName, userEmail, accessToken, refreshToken,
                java.sql.Timestamp.from(expiresAt));
    }

    private static HubSpotConnection mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        java.sql.Timestamp ts = rs.getTimestamp("expires_at");
        return new HubSpotConnection(
                rs.getLong("id"),
                rs.getString("login_id"),
                rs.getString("hubspot_portal_id"),
                rs.getString("hubspot_portal_name"),
                rs.getString("hubspot_user_email"),
                rs.getString("access_token"),
                rs.getString("refresh_token"),
                ts != null ? ts.toInstant() : null);
    }

    private String newState() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String enc(String v) {
        return URLEncoder.encode(v != null ? v : "", StandardCharsets.UTF_8);
    }

    private record StateEntry(String loginId, Instant expiresAt) {}

    private record TokenMetadata(String portalId, String portalName, String userEmail) {}

    public static class HubSpotReconnectRequiredException extends RuntimeException {
        public HubSpotReconnectRequiredException(String loginId, Throwable cause) {
            super("HubSpot reconnect required for loginId=" + loginId, cause);
        }
    }
}
