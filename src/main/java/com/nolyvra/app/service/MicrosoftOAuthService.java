package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.InboxMessageSummary;
import com.nolyvra.app.model.InboxPageResponse;
import com.nolyvra.app.model.InboxThreadMessage;
import com.nolyvra.app.model.OAuthToken;
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
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class MicrosoftOAuthService {

    private static final Logger log = LoggerFactory.getLogger(MicrosoftOAuthService.class);

    private static final String AUTH_URL      = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
    private static final String TOKEN_URL     = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    private static final String SEND_MAIL_URL = "https://graph.microsoft.com/v1.0/me/sendMail";
    private static final String INBOX_URL     = "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages";
    private static final String MESSAGES_URL  = "https://graph.microsoft.com/v1.0/me/messages";
    // Mail.ReadWrite added for the Email Centre inbox (list/read/mark-read/archive) —
    // Mail.Send kept as its own scope since Graph requires it explicitly for sendMail
    // even when ReadWrite is also granted. Existing connections must reconnect to
    // pick up the new scope.
    private static final String SCOPES        = "openid email profile Mail.Send Mail.ReadWrite offline_access";

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
            throw new RuntimeException("Graph API error " + res.statusCode());
        }
    }

    // ─── Live inbox read (Email Centre) — nothing fetched here is persisted;
    // every call goes straight to Graph so the inbox always reflects the real
    // mailbox. ────────────────────────────────────────────────────────────────

    private static final String LIST_SELECT = "$select=id,conversationId,subject,from,toRecipients,"
            + "bodyPreview,receivedDateTime,isRead";

    // pageToken (when present) is the full Graph @odata.nextLink from a previous
    // page — Graph's own opaque cursor, not something we compute or store.
    public InboxPageResponse listInboxMessages(String loginId, boolean unreadOnly, String pageToken, int pageSize)
            throws Exception {
        String accessToken = getValidAccessToken(loginId);
        if (accessToken == null) throw new IllegalStateException("No valid Outlook token for: " + loginId);

        String url;
        if (pageToken != null && !pageToken.isBlank()) {
            url = pageToken;
        } else {
            url = INBOX_URL + "?" + LIST_SELECT
                    + "&$orderby=receivedDateTime desc"
                    + "&$top=" + pageSize
                    + (unreadOnly ? "&$filter=isRead eq false" : "");
        }
        JsonNode json = getJson(url, accessToken);
        List<InboxMessageSummary> messages = new ArrayList<>();
        for (JsonNode m : json.path("value")) {
            messages.add(new InboxMessageSummary(
                    m.path("id").asText(),
                    m.path("conversationId").asText(),
                    "microsoft",
                    m.path("from").path("emailAddress").path("name").asText(""),
                    m.path("from").path("emailAddress").path("address").asText(""),
                    m.path("subject").asText(""),
                    m.path("bodyPreview").asText(""),
                    parseGraphDate(m.path("receivedDateTime").asText(null)),
                    !m.path("isRead").asBoolean(true)));
        }
        String nextLink = json.path("@odata.nextLink").asText(null);
        return new InboxPageResponse(messages, nextLink);
    }

    // A Graph "conversation" is the closest thing to a thread — every message
    // sharing a conversationId, oldest first so the detail pane reads top-down.
    public List<InboxThreadMessage> getConversationMessages(String loginId, String conversationId) throws Exception {
        String accessToken = getValidAccessToken(loginId);
        if (accessToken == null) throw new IllegalStateException("No valid Outlook token for: " + loginId);

        String url = MESSAGES_URL + "?$filter=" + enc("conversationId eq '" + conversationId + "'")
                + "&$orderby=receivedDateTime asc"
                + "&$select=id,conversationId,subject,from,toRecipients,body,receivedDateTime,isRead";
        JsonNode json = getJson(url, accessToken);

        List<InboxThreadMessage> messages = new ArrayList<>();
        for (JsonNode m : json.path("value")) {
            List<String> toAddresses = new ArrayList<>();
            for (JsonNode t : m.path("toRecipients")) {
                String addr = t.path("emailAddress").path("address").asText(null);
                if (addr != null && !addr.isBlank()) toAddresses.add(addr);
            }
            String bodyContent = m.path("body").path("content").asText("");
            boolean isHtml = "html".equalsIgnoreCase(m.path("body").path("contentType").asText(""));
            messages.add(new InboxThreadMessage(
                    m.path("id").asText(),
                    "microsoft",
                    m.path("from").path("emailAddress").path("name").asText(""),
                    m.path("from").path("emailAddress").path("address").asText(""),
                    toAddresses,
                    m.path("subject").asText(""),
                    isHtml ? bodyContent : null,
                    isHtml ? null : bodyContent,
                    parseGraphDate(m.path("receivedDateTime").asText(null)),
                    false, // direction resolved by the caller against the mailbox's own address
                    !m.path("isRead").asBoolean(true)));
        }
        return messages;
    }

    private static Instant parseGraphDate(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try { return java.time.OffsetDateTime.parse(iso).toInstant(); }
        catch (Exception e) { return null; }
    }

    public void markMessageRead(String loginId, String messageId, boolean read) throws Exception {
        String accessToken = getValidAccessToken(loginId);
        if (accessToken == null) throw new IllegalStateException("No valid Outlook token for: " + loginId);

        String payload = objectMapper.writeValueAsString(Map.of("isRead", read));
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(MESSAGES_URL + "/" + enc(messageId)))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString(payload))
                .build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) throw new RuntimeException("Graph API error " + res.statusCode());
    }

    public void archiveMessage(String loginId, String messageId) throws Exception {
        String accessToken = getValidAccessToken(loginId);
        if (accessToken == null) throw new IllegalStateException("No valid Outlook token for: " + loginId);

        String payload = objectMapper.writeValueAsString(Map.of("destinationId", "archive"));
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(MESSAGES_URL + "/" + enc(messageId) + "/move"))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) throw new RuntimeException("Graph API error " + res.statusCode());
    }

    private JsonNode getJson(String url, String accessToken) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + accessToken)
                .GET().build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) throw new RuntimeException("Graph API error " + res.statusCode());
        return objectMapper.readTree(res.body());
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
        JsonNode json = objectMapper.readTree(res.body());
        if (res.statusCode() >= 400) {
            log.warn("[OAuth] token endpoint returned status={}", res.statusCode());
            throw new RuntimeException("Microsoft OAuth token endpoint returned status " + res.statusCode());
        }
        log.debug("[OAuth] token endpoint status={} accessTokenReceived={} refreshTokenReceived={}",
                res.statusCode(),
                json.hasNonNull("access_token"),
                json.hasNonNull("refresh_token"));
        return json;
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
