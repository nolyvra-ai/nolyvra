package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.XeroConnection;
import com.xero.api.ApiClient;
import com.xero.api.client.IdentityApi;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class XeroOAuthService {

    private static final Logger log = LoggerFactory.getLogger(XeroOAuthService.class);

    private static final String AUTH_URL   = "https://login.xero.com/identity/connect/authorize";
    private static final String TOKEN_URL  = "https://identity.xero.com/connect/token";
    private static final String REVOKE_URL = "https://identity.xero.com/connect/revocation";
    private static final String SCOPES = "openid profile email offline_access accounting.contacts accounting.transactions";

    private static final long STATE_TTL_SECONDS = 600; // 10 minutes

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final IdentityApi identityApi;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, StateEntry> pendingStates = new ConcurrentHashMap<>();
    private final Map<String, Object> refreshLocks = new ConcurrentHashMap<>();

    public XeroOAuthService(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            @Value("${xero.client-id:}") String clientId,
            @Value("${xero.client-secret:}") String clientSecret,
            @Value("${xero.redirect-uri:http://localhost:8080/auth/xero/callback}") String redirectUri) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
        this.identityApi = new IdentityApi(new ApiClient());
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    // ─── Authorization URL ────────────────────────────────────────────────────

    public String getAuthorizationUrl(String loginId) {
        String state = newState();
        pendingStates.put(state, new StateEntry(loginId, Instant.now().plusSeconds(STATE_TTL_SECONDS)));

        return AUTH_URL
                + "?response_type=code"
                + "&client_id=" + enc(clientId)
                + "&redirect_uri=" + enc(redirectUri)
                + "&scope=" + enc(SCOPES)
                + "&state=" + enc(state);
    }

    // ─── Exchange auth code for token ─────────────────────────────────────────

    public void exchangeCodeForToken(String code, String state) throws Exception {
        StateEntry entry = pendingStates.remove(state);
        if (entry == null || Instant.now().isAfter(entry.expiresAt())) {
            throw new IllegalStateException("Invalid or expired Xero OAuth state");
        }
        String loginId = entry.loginId();

        String body = "grant_type=authorization_code"
                + "&code=" + enc(code)
                + "&redirect_uri=" + enc(redirectUri)
                + "&client_id=" + enc(clientId)
                + "&client_secret=" + enc(clientSecret);

        JsonNode json = postForm(TOKEN_URL, body);
        String accessToken  = json.path("access_token").asText();
        String refreshToken = json.path("refresh_token").asText(null);
        Instant expiresAt   = Instant.now().plusSeconds(json.path("expires_in").asLong(1800));

        // Note: a Xero user can authorize access to multiple tenants/orgs in one
        // consent grant. This sprint only persists the first connection returned -
        // multi-org selection is a known limitation, not handled here.
        List<com.xero.models.identity.Connection> connections = identityApi.getConnections(accessToken, null);
        if (connections == null || connections.isEmpty()) {
            throw new IllegalStateException("Xero returned no connections for this authorization");
        }
        com.xero.models.identity.Connection first = connections.get(0);
        String tenantId = first.getTenantId() != null ? first.getTenantId().toString() : null;
        String tenantName = first.getTenantName();

        upsertConnection(loginId, tenantId, tenantName, accessToken, refreshToken, expiresAt);
    }

    // ─── Status / disconnect ──────────────────────────────────────────────────

    public XeroConnection getConnection(String loginId) {
        return jdbc.query("""
                select id, login_id, xero_tenant_id, xero_tenant_name, access_token, refresh_token, expires_at
                from xero_connection
                where login_id = ?
                order by updated_at desc
                limit 1
                """, rs -> {
            if (!rs.next()) return null;
            return mapRow(rs);
        }, loginId);
    }

    public void disconnect(String loginId) {
        XeroConnection connection = getConnection(loginId);
        if (connection == null) return;

        try {
            String body = "client_id=" + enc(clientId)
                    + "&client_secret=" + enc(clientSecret)
                    + "&token=" + enc(connection.refreshToken());
            postForm(REVOKE_URL, body);
        } catch (Exception e) {
            log.warn("[XeroOAuth] revocation call failed for loginId={}: {}", loginId, e.getMessage());
        }

        jdbc.update("delete from xero_connection where login_id = ?", loginId);
    }

    // ─── Get a valid (auto-refreshed) access token ────────────────────────────

    public String getValidAccessToken(String loginId, String tenantId) throws Exception {
        XeroConnection connection = getConnection(loginId);
        if (connection == null) return null;

        boolean expiringSoon = Instant.now().isAfter(connection.expiresAt().minusSeconds(300));
        if (!expiringSoon) {
            return connection.accessToken();
        }

        Object lock = refreshLocks.computeIfAbsent(loginId, k -> new Object());
        synchronized (lock) {
            // Re-check after acquiring the lock - another thread may have just refreshed.
            XeroConnection current = getConnection(loginId);
            if (current == null) return null;
            boolean stillExpiringSoon = Instant.now().isAfter(current.expiresAt().minusSeconds(300));
            if (!stillExpiringSoon) {
                return current.accessToken();
            }
            return doRefresh(current);
        }
    }

    private String doRefresh(XeroConnection connection) throws Exception {
        String body = "grant_type=refresh_token"
                + "&refresh_token=" + enc(connection.refreshToken())
                + "&client_id=" + enc(clientId)
                + "&client_secret=" + enc(clientSecret);

        JsonNode json;
        try {
            json = postForm(TOKEN_URL, body);
        } catch (Exception e) {
            // Xero refresh tokens expire after 60 days of non-use. Treat any
            // failure here as "reconnect required" rather than a hard error.
            throw new XeroReconnectRequiredException(connection.loginId(), e);
        }

        String newAccess = json.path("access_token").asText();
        String newRefresh = json.path("refresh_token").asText(null);
        if (newRefresh == null || newRefresh.isBlank()) {
            // Xero always rotates the refresh token on a successful refresh.
            // A missing one means the response was unexpected - treat as reconnect-required.
            throw new XeroReconnectRequiredException(connection.loginId(), null);
        }
        Instant expiresAt = Instant.now().plusSeconds(json.path("expires_in").asLong(1800));

        // Atomic write-back of the rotated access+refresh pair, same row.
        upsertConnection(connection.loginId(), connection.xeroTenantId(), connection.xeroTenantName(),
                newAccess, newRefresh, expiresAt);
        return newAccess;
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private String newState() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
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
            log.warn("[XeroOAuth] token endpoint returned status={}", res.statusCode());
            throw new RuntimeException("Xero OAuth token endpoint returned status " + res.statusCode());
        }
        log.debug("[XeroOAuth] token endpoint status={} accessTokenReceived={} refreshTokenReceived={}",
                res.statusCode(),
                json.hasNonNull("access_token"),
                json.hasNonNull("refresh_token"));
        return json;
    }

    private void upsertConnection(String loginId, String tenantId, String tenantName,
                                   String accessToken, String refreshToken, Instant expiresAt) {
        jdbc.update("""
                insert into xero_connection
                    (login_id, xero_tenant_id, xero_tenant_name, access_token, refresh_token, expires_at)
                values (?, ?, ?, ?, ?, ?)
                on conflict (login_id, xero_tenant_id) do update set
                    xero_tenant_name = excluded.xero_tenant_name,
                    access_token     = excluded.access_token,
                    refresh_token    = excluded.refresh_token,
                    expires_at       = excluded.expires_at,
                    updated_at       = now()
                """, loginId, tenantId, tenantName, accessToken, refreshToken,
                java.sql.Timestamp.from(expiresAt));
    }

    private static XeroConnection mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        java.sql.Timestamp ts = rs.getTimestamp("expires_at");
        return new XeroConnection(
                rs.getLong("id"),
                rs.getString("login_id"),
                rs.getString("xero_tenant_id"),
                rs.getString("xero_tenant_name"),
                rs.getString("access_token"),
                rs.getString("refresh_token"),
                ts != null ? ts.toInstant() : null);
    }

    private static String enc(String v) {
        return URLEncoder.encode(v != null ? v : "", StandardCharsets.UTF_8);
    }

    private record StateEntry(String loginId, Instant expiresAt) {}

    public static class XeroReconnectRequiredException extends RuntimeException {
        public final String loginId;

        public XeroReconnectRequiredException(String loginId, Throwable cause) {
            super("Xero reconnect required for loginId=" + loginId, cause);
            this.loginId = loginId;
        }
    }
}
