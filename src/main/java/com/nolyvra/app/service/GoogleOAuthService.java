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
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class GoogleOAuthService {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthService.class);

    private static final String AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
    private static final String SEND_MAIL_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    private static final String MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
    private static final String THREADS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/threads";
    // gmail.modify added for the Email Centre inbox (list/read/mark-read/archive) —
    // it's a superset of gmail.send, kept alongside it for clarity. Existing
    // connections must reconnect to pick up the new scope.
    private static final String SCOPES = "openid email profile https://www.googleapis.com/auth/gmail.send"
            + " https://www.googleapis.com/auth/gmail.modify";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;
    // Gmail's message-list endpoint only returns ids — fetching each message's
    // metadata for the inbox list view is fanned out in parallel over this pool,
    // same pattern as TalentSearchService's coreSignalApiExecutor.
    private final ExecutorService inboxExecutor = Executors.newFixedThreadPool(8);

    public GoogleOAuthService(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            @Value("${google.client-id:}") String clientId,
            @Value("${google.client-secret:}") String clientSecret,
            @Value("${google.redirect-uri:http://localhost:8080/auth/google/callback}") String redirectUri) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    public String getAuthorizationUrl(String loginId) {
        return AUTH_URL
                + "?client_id=" + enc(clientId)
                + "&response_type=code"
                + "&redirect_uri=" + enc(redirectUri)
                + "&scope=" + enc(SCOPES)
                + "&access_type=offline"
                + "&prompt=consent"
                + "&state=" + enc(loginId);
    }

    public void exchangeCodeForToken(String code, String loginId) throws Exception {
        String body = "client_id=" + enc(clientId)
                + "&client_secret=" + enc(clientSecret)
                + "&code=" + enc(code)
                + "&redirect_uri=" + enc(redirectUri)
                + "&grant_type=authorization_code";

        JsonNode json = postForm(TOKEN_URL, body);
        String accessToken = json.path("access_token").asText();
        String refreshToken = json.path("refresh_token").asText(null);
        Instant expiresAt = Instant.now().plusSeconds(json.path("expires_in").asLong(3600));
        String email = fetchUserEmail(accessToken);

        upsertToken(loginId, accessToken, refreshToken, expiresAt, email);
    }

    public OAuthToken getToken(String loginId) {
        return jdbc.query("""
                select id, login_id, provider, access_token, refresh_token, expires_at, email
                from oauth_tokens
                where login_id = ? and provider = 'google'
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
        jdbc.update("delete from oauth_tokens where login_id = ? and provider = 'google'", loginId);
    }

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

    public void sendEmailViaGmail(String loginId, String toAddress, String subject, String body)
            throws Exception {
        String accessToken = getValidAccessToken(loginId);
        if (accessToken == null) {
            throw new IllegalStateException("No valid Gmail token for: " + loginId);
        }

        String rawMessage = buildRawMessage(toAddress, subject, body);
        String payload = objectMapper.writeValueAsString(Map.of("raw", rawMessage));

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(SEND_MAIL_URL))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) {
            throw new RuntimeException("Gmail API error " + res.statusCode());
        }
    }

    // ─── Live inbox read (Email Centre) — nothing fetched here is persisted;
    // every call goes straight to Gmail so the inbox always reflects the real
    // mailbox. ────────────────────────────────────────────────────────────────

    public InboxPageResponse listInboxMessages(String loginId, boolean unreadOnly, String pageToken, int pageSize)
            throws Exception {
        String accessToken = getValidAccessToken(loginId);
        if (accessToken == null) throw new IllegalStateException("No valid Gmail token for: " + loginId);

        String q = unreadOnly ? "in:inbox is:unread" : "in:inbox";
        String listUrl = MESSAGES_URL + "?q=" + enc(q) + "&maxResults=" + pageSize
                + (pageToken != null && !pageToken.isBlank() ? "&pageToken=" + enc(pageToken) : "");
        JsonNode listJson = getJson(listUrl, accessToken);

        // Gmail's list endpoint only returns {id, threadId} — fan out metadata
        // fetches in parallel rather than N sequential round trips.
        List<String> ids = new ArrayList<>();
        for (JsonNode idNode : listJson.path("messages")) ids.add(idNode.path("id").asText());

        List<InboxMessageSummary> messages = new CopyOnWriteArrayList<>();
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        for (String id : ids) {
            futures.add(CompletableFuture.runAsync(() -> {
                try { messages.add(fetchMessageSummary(accessToken, id)); }
                catch (Exception ignored) { /* skip a message that failed to fetch rather than fail the whole page */ }
            }, inboxExecutor));
        }
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        // Parallel fetch scrambles order — restore Gmail's own recency ordering.
        messages.sort(Comparator.comparing(InboxMessageSummary::occurredAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        return new InboxPageResponse(messages, listJson.path("nextPageToken").asText(null));
    }

    private InboxMessageSummary fetchMessageSummary(String accessToken, String id) throws Exception {
        String url = MESSAGES_URL + "/" + enc(id)
                + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject";
        JsonNode m = getJson(url, accessToken);
        Map<String, String> headers = extractHeaders(m);
        String[] from = splitNameAddress(headers.getOrDefault("From", ""));
        return new InboxMessageSummary(
                m.path("id").asText(),
                m.path("threadId").asText(),
                "google",
                from[0], from[1],
                headers.getOrDefault("Subject", ""),
                m.path("snippet").asText(""),
                parseInternalDate(m),
                isUnread(m));
    }

    // A Gmail "thread" already groups every message in the conversation —
    // oldest first so the detail pane reads top-down.
    public List<InboxThreadMessage> getThreadMessages(String loginId, String threadId) throws Exception {
        String accessToken = getValidAccessToken(loginId);
        if (accessToken == null) throw new IllegalStateException("No valid Gmail token for: " + loginId);

        JsonNode thread = getJson(THREADS_URL + "/" + enc(threadId) + "?format=full", accessToken);

        List<InboxThreadMessage> result = new ArrayList<>();
        for (JsonNode m : thread.path("messages")) {
            Map<String, String> headers = extractHeaders(m);
            String[] from = splitNameAddress(headers.getOrDefault("From", ""));
            List<String> toAddresses = new ArrayList<>();
            for (String addr : headers.getOrDefault("To", "").split(",")) {
                String a = splitNameAddress(addr.trim())[1];
                if (!a.isBlank()) toAddresses.add(a);
            }
            JsonNode payload = m.path("payload");
            String html = findMimePart(payload, "text/html");
            String text = findMimePart(payload, "text/plain");

            result.add(new InboxThreadMessage(
                    m.path("id").asText(),
                    "google",
                    from[0], from[1],
                    toAddresses,
                    headers.getOrDefault("Subject", ""),
                    html, text,
                    parseInternalDate(m),
                    false, // direction resolved by the caller against the mailbox's own address
                    isUnread(m)));
        }
        return result;
    }

    public void markMessageRead(String loginId, String messageId, boolean read) throws Exception {
        String accessToken = getValidAccessToken(loginId);
        if (accessToken == null) throw new IllegalStateException("No valid Gmail token for: " + loginId);
        String payload = objectMapper.writeValueAsString(read
                ? Map.of("removeLabelIds", List.of("UNREAD"))
                : Map.of("addLabelIds", List.of("UNREAD")));
        postModify(accessToken, messageId, payload);
    }

    public void archiveMessage(String loginId, String messageId) throws Exception {
        String accessToken = getValidAccessToken(loginId);
        if (accessToken == null) throw new IllegalStateException("No valid Gmail token for: " + loginId);
        String payload = objectMapper.writeValueAsString(Map.of("removeLabelIds", List.of("INBOX")));
        postModify(accessToken, messageId, payload);
    }

    private void postModify(String accessToken, String messageId, String payload) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(MESSAGES_URL + "/" + enc(messageId) + "/modify"))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) throw new RuntimeException("Gmail API error " + res.statusCode());
    }

    private JsonNode getJson(String url, String accessToken) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + accessToken)
                .GET().build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) throw new RuntimeException("Gmail API error " + res.statusCode());
        return objectMapper.readTree(res.body());
    }

    private static Instant parseInternalDate(JsonNode message) {
        try { return Instant.ofEpochMilli(Long.parseLong(message.path("internalDate").asText("0"))); }
        catch (Exception e) { return null; }
    }

    private static boolean isUnread(JsonNode message) {
        for (JsonNode label : message.path("labelIds")) {
            if ("UNREAD".equals(label.asText())) return true;
        }
        return false;
    }

    private static Map<String, String> extractHeaders(JsonNode message) {
        Map<String, String> headers = new HashMap<>();
        for (JsonNode h : message.path("payload").path("headers")) {
            headers.put(h.path("name").asText(), h.path("value").asText(""));
        }
        return headers;
    }

    private static String[] splitNameAddress(String raw) {
        if (raw == null || raw.isBlank()) return new String[]{"", ""};
        int lt = raw.indexOf('<');
        int gt = raw.indexOf('>');
        if (lt >= 0 && gt > lt) {
            String name = raw.substring(0, lt).trim().replaceAll("^\"|\"$", "");
            String addr = raw.substring(lt + 1, gt).trim();
            return new String[]{name, addr};
        }
        return new String[]{"", raw.trim()};
    }

    // Recursively walks Gmail's (possibly multipart) MIME payload for the first
    // part matching mimeType, decoding its base64url body.
    private static String findMimePart(JsonNode payload, String mimeType) {
        if (payload == null || payload.isMissingNode()) return null;
        if (mimeType.equals(payload.path("mimeType").asText(""))) {
            return decodeBase64Url(payload.path("body").path("data").asText(null));
        }
        for (JsonNode part : payload.path("parts")) {
            String found = findMimePart(part, mimeType);
            if (found != null) return found;
        }
        return null;
    }

    private static String decodeBase64Url(String data) {
        if (data == null || data.isBlank()) return null;
        try { return new String(Base64.getUrlDecoder().decode(data), StandardCharsets.UTF_8); }
        catch (Exception e) { return null; }
    }

    private String fetchUserEmail(String accessToken) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(USERINFO_URL))
                    .header("Authorization", "Bearer " + accessToken)
                    .GET()
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode json = objectMapper.readTree(res.body());
            return json.path("email").asText("");
        } catch (Exception e) {
            return "";
        }
    }

    private String doRefresh(String loginId, String refreshToken, String existingEmail) throws Exception {
        String body = "client_id=" + enc(clientId)
                + "&client_secret=" + enc(clientSecret)
                + "&refresh_token=" + enc(refreshToken)
                + "&grant_type=refresh_token";

        JsonNode json = postForm(TOKEN_URL, body);
        String newAccess = json.path("access_token").asText();
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
            log.warn("[GoogleOAuth] token endpoint returned status={}", res.statusCode());
            throw new RuntimeException("Google OAuth token endpoint returned status " + res.statusCode());
        }
        log.debug("[GoogleOAuth] token endpoint status={} accessTokenReceived={} refreshTokenReceived={}",
                res.statusCode(),
                json.hasNonNull("access_token"),
                json.hasNonNull("refresh_token"));
        return json;
    }

    private void upsertToken(String loginId, String accessToken, String refreshToken,
                             Instant expiresAt, String email) {
        jdbc.update("""
                insert into oauth_tokens (login_id, provider, access_token, refresh_token, expires_at, email)
                values (?, 'google', ?, ?, ?, ?)
                on conflict (login_id, provider) do update set
                    access_token  = excluded.access_token,
                    refresh_token = coalesce(excluded.refresh_token, oauth_tokens.refresh_token),
                    expires_at    = excluded.expires_at,
                    email         = excluded.email,
                    updated_at    = now()
                """, loginId, accessToken, refreshToken,
                expiresAt != null ? java.sql.Timestamp.from(expiresAt) : null,
                email);
    }

    private static String buildRawMessage(String toAddress, String subject, String body) {
        String safeTo = sanitizeHeader(toAddress);
        String safeSubject = sanitizeHeader(subject);
        String content = body != null ? body : "";
        boolean html = content.trim().startsWith("<");
        String mime = "To: " + safeTo + "\r\n"
                + "Subject: " + safeSubject + "\r\n"
                + "MIME-Version: 1.0\r\n"
                + "Content-Type: " + (html ? "text/html" : "text/plain") + "; charset=UTF-8\r\n"
                + "Content-Transfer-Encoding: 8bit\r\n"
                + "\r\n"
                + content;
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(mime.getBytes(StandardCharsets.UTF_8));
    }

    private static String sanitizeHeader(String value) {
        return (value != null ? value : "").replace("\r", "").replace("\n", "").trim();
    }

    private static String enc(String v) {
        return URLEncoder.encode(v != null ? v : "", StandardCharsets.UTF_8);
    }
}
