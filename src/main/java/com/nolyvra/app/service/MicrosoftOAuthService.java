package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.OAuthToken;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;

@Service
public class MicrosoftOAuthService {

    private static final String AUTH_URL      = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
    private static final String TOKEN_URL     = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    private static final String SEND_MAIL_URL = "https://graph.microsoft.com/v1.0/me/sendMail";
    private static final String SCOPES        = "openid email profile Mail.Send offline_access";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final HttpClient   httpClient;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    public MicrosoftOAuthService(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            @Value("${microsoft.client-id:}") String clientId,
            @Value("${microsoft.client-secret:}") String clientSecret,
            @Value("${microsoft.redirect-uri:http://localhost:8080/auth/microsoft/callback}") String redirectUri) {
        this.jdbc         = jdbc;
        this.objectMapper = objectMapper;
        this.httpClient   = HttpClient.newHttpClient();
        this.clientId     = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri  = redirectUri;
    }

    // ─── Authorization URL ────────────────────────────────────────────────────

    public String getAuthorizationUrl(String loginId) {
        return AUTH_URL
                + "?client_id="       + enc(clientId)
                + "&response_type=code"
                + "&redirect_uri="    + enc(redirectUri)
                + "&response_mode=query"
                + "&scope="           + enc(SCOPES)
                + "&state="           + enc(loginId);
    }

    // ─── Exchange auth code for token ─────────────────────────────────────────

    public void exchangeCodeForToken(String code, String loginId) throws Exception {
        String body = "client_id="     + enc(clientId)
                + "&scope="            + enc(SCOPES)
                + "&code="             + enc(code)
                + "&redirect_uri="     + enc(redirectUri)
                + "&grant_type=authorization_code"
                + "&client_secret="    + enc(clientSecret);

        JsonNode json = postForm(TOKEN_URL, body);
        String accessToken  = json.path("access_token").asText();
        String refreshToken = json.path("refresh_token").asText(null);
        Instant expiresAt   = Instant.now().plusSeconds(json.path("expires_in").asLong(3600));
        String email        = fetchUserEmail(accessToken);

        upsertToken(loginId, accessToken, refreshToken, expiresAt, email);
    }

    // ─── Status / disconnect ──────────────────────────────────────────────────

    public OAuthToken getToken(String loginId) {
        return jdbc.query("""
                select id, login_id, provider, access_token, refresh_token, expires_at, email
                from oauth_tokens
                where login_id = ? and provider = 'microsoft'
                """, rs -> {
            if (!rs.next()) return null;
            java.sql.Timestamp ts = rs.getTimestamp("expires_at");
            return new OAuthToken(
                    rs.getLong("id"),
                    rs.getString("login_id"),
                    rs.getString("provider"),
                    rs.getString("access_token"),
                    rs.getString("refresh_token"),
                    ts != null ? ts.toInstant() : null,
                    rs.getString("email"));
        }, loginId);
    }

    public void disconnect(String loginId) {
        jdbc.update("delete from oauth_tokens where login_id = ? and provider = 'microsoft'", loginId);
    }

    // ─── Get a valid (auto-refreshed) access token ────────────────────────────

    public String getValidAccessToken(String loginId) throws Exception {
        OAuthToken token = getToken(loginId);
        if (token == null) return null;

        boolean expiringSoon = token.expiresAt() != null
                && Instant.now().isAfter(token.expiresAt().minusSeconds(300));

        if (expiringSoon) {
            if (token.refreshToken() == null || token.refreshToken().isBlank()) return null;
            return doRefresh(loginId, token.refreshToken(), token.email());
        }
        return token.accessToken();
    }

    // ─── Send email via Microsoft Graph ──────────────────────────────────────

    public void sendEmailViaOutlook(String loginId, String toAddress, String subject, String body)
            throws Exception {
        String accessToken = getValidAccessToken(loginId);
        if (accessToken == null)
            throw new IllegalStateException("No valid Outlook token for: " + loginId);

        String contentType = (body != null && body.trim().startsWith("<")) ? "HTML" : "Text";

        String payload = objectMapper.writeValueAsString(Map.of(
                "message", Map.of(
                        "subject", subject,
                        "body", Map.of("contentType", contentType, "content", body != null ? body : ""),
                        "toRecipients", new Object[]{
                                Map.of("emailAddress", Map.of("address", toAddress))
                        }),
                "saveToSentItems", true));

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(SEND_MAIL_URL))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) {
            throw new RuntimeException("Graph API error " + res.statusCode() + ": " + res.body());
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private String fetchUserEmail(String accessToken) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName"))
                    .header("Authorization", "Bearer " + accessToken)
                    .GET().build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode json = objectMapper.readTree(res.body());
            String mail = json.path("mail").asText(null);
            if (mail == null || mail.isBlank()) mail = json.path("userPrincipalName").asText("");
            return mail;
        } catch (Exception e) {
            return "";
        }
    }

    private String doRefresh(String loginId, String refreshToken, String existingEmail) throws Exception {
        String body = "client_id="     + enc(clientId)
                + "&scope="            + enc(SCOPES)
                + "&refresh_token="    + enc(refreshToken)
                + "&grant_type=refresh_token"
                + "&client_secret="    + enc(clientSecret);

        JsonNode json = postForm(TOKEN_URL, body);
        String newAccess  = json.path("access_token").asText();
        String newRefresh = json.path("refresh_token").asText(refreshToken);
        Instant expiresAt = Instant.now().plusSeconds(json.path("expires_in").asLong(3600));

        upsertToken(loginId, newAccess, newRefresh, expiresAt, existingEmail);
        return newAccess;
    }

    private JsonNode postForm(String url, String formBody) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(formBody))
                .build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        return objectMapper.readTree(res.body());
    }

    private void upsertToken(String loginId, String accessToken, String refreshToken,
                             Instant expiresAt, String email) {
        jdbc.update("""
                insert into oauth_tokens (login_id, provider, access_token, refresh_token, expires_at, email)
                values (?, 'microsoft', ?, ?, ?, ?)
                on conflict (login_id, provider) do update set
                    access_token  = excluded.access_token,
                    refresh_token = excluded.refresh_token,
                    expires_at    = excluded.expires_at,
                    email         = excluded.email,
                    updated_at    = now()
                """, loginId, accessToken, refreshToken,
                expiresAt != null ? java.sql.Timestamp.from(expiresAt) : null,
                email);
    }

    private static String enc(String v) {
        return URLEncoder.encode(v != null ? v : "", StandardCharsets.UTF_8);
    }
}
