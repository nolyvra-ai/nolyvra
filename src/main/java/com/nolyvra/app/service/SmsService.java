package com.nolyvra.app.service;

import com.nolyvra.app.model.SmsHistoryResponse;
import com.nolyvra.app.model.SmsSendRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;

@Service
public class SmsService {

    private final JdbcTemplate jdbc;
    private final WorkflowService workflowService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String provider;
    private final String twilioAccountSid;
    private final String twilioAuthToken;
    private final String twilioFromNumber;

    public SmsService(
            JdbcTemplate jdbc,
            WorkflowService workflowService,
            ObjectMapper objectMapper,
            @Value("${sms.provider:disabled}") String provider,
            @Value("${sms.twilio.account-sid:}") String twilioAccountSid,
            @Value("${sms.twilio.auth-token:}") String twilioAuthToken,
            @Value("${sms.twilio.from-number:}") String twilioFromNumber) {
        this.jdbc = jdbc;
        this.workflowService = workflowService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
        this.provider = provider == null ? "disabled" : provider.trim().toLowerCase();
        this.twilioAccountSid = twilioAccountSid;
        this.twilioAuthToken = twilioAuthToken;
        this.twilioFromNumber = twilioFromNumber;
    }

    private static final RowMapper<SmsHistoryResponse> HISTORY_MAPPER = (rs, rowNum) -> {
        OffsetDateTime sentAt = rs.getObject("sent_at", OffsetDateTime.class);
        return new SmsHistoryResponse(
                rs.getLong("id"),
                rs.getString("candidate_id"),
                rs.getString("to_number"),
                rs.getString("body"),
                rs.getString("template_type"),
                rs.getString("provider"),
                rs.getString("status"),
                rs.getString("provider_message_id"),
                rs.getString("error_message"),
                sentAt != null ? sentAt.toInstant() : null);
    };

    public SmsHistoryResponse sendSms(SmsSendRequest req, String loginId) {
        String status = "Sent";
        String providerMessageId = null;
        String errorMessage = null;

        try {
            providerMessageId = switch (provider) {
                case "twilio" -> sendViaTwilio(req.toNumber(), req.body());
                case "disabled", "none", "" -> throw new IllegalStateException("SMS provider is disabled");
                default -> throw new IllegalStateException("Unsupported SMS provider: " + provider);
            };
        } catch (Exception e) {
            status = "Failed";
            errorMessage = sanitizeError(e);
            System.err.println("Failed to send SMS: " + errorMessage);
        }

        var keys = new org.springframework.jdbc.support.GeneratedKeyHolder();
        final String finalStatus = status;
        final String finalProviderMessageId = providerMessageId;
        final String finalErrorMessage = errorMessage;
        jdbc.update(con -> {
            var ps = con.prepareStatement("""
                    insert into sms_history
                        (candidate_id, login_id, to_number, body, template_type,
                         provider, status, provider_message_id, error_message)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, new String[]{"id"});
            ps.setString(1, blankToNull(req.candidateId()));
            ps.setString(2, loginId);
            ps.setString(3, req.toNumber());
            ps.setString(4, req.body());
            ps.setString(5, blankToNull(req.templateType()));
            ps.setString(6, provider);
            ps.setString(7, finalStatus);
            ps.setString(8, finalProviderMessageId);
            ps.setString(9, finalErrorMessage);
            return ps;
        }, keys);

        Long newId = keys.getKey() != null ? keys.getKey().longValue() : null;

        if ("Sent".equals(status) && req.candidateId() != null && !req.candidateId().isBlank()) {
            workflowService.recordEvent(req.candidateId(), loginId, "SMS_SENT",
                    "SMS sent to " + req.toNumber(), null);
        }

        return new SmsHistoryResponse(
                newId,
                blankToNull(req.candidateId()),
                req.toNumber(),
                req.body(),
                blankToNull(req.templateType()),
                provider,
                status,
                providerMessageId,
                errorMessage,
                Instant.now());
    }

    public List<SmsHistoryResponse> getSmsHistory(String loginId, String candidateId) {
        if (candidateId != null && !candidateId.isBlank()) {
            return jdbc.query("""
                    select id, candidate_id, to_number, body, template_type, provider,
                           status, provider_message_id, error_message, sent_at
                    from sms_history
                    where login_id = ? and candidate_id = ?
                    order by sent_at desc
                    """, HISTORY_MAPPER, loginId, candidateId);
        }
        return jdbc.query("""
                select id, candidate_id, to_number, body, template_type, provider,
                       status, provider_message_id, error_message, sent_at
                from sms_history
                where login_id = ?
                order by sent_at desc
                """, HISTORY_MAPPER, loginId);
    }

    private String sendViaTwilio(String toNumber, String body) throws Exception {
        requireConfig(twilioAccountSid, "sms.twilio.account-sid");
        requireConfig(twilioAuthToken, "sms.twilio.auth-token");
        requireConfig(twilioFromNumber, "sms.twilio.from-number");

        String form = "To=" + encode(toNumber)
                + "&From=" + encode(twilioFromNumber)
                + "&Body=" + encode(body);
        String auth = Base64.getEncoder().encodeToString(
                (twilioAccountSid + ":" + twilioAuthToken).getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.twilio.com/2010-04-01/Accounts/"
                        + twilioAccountSid + "/Messages.json"))
                .header("Authorization", "Basic " + auth)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode root = objectMapper.readTree(response.body());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String message = root.path("message").asText("Twilio returned HTTP " + response.statusCode());
            throw new IllegalStateException(message);
        }
        return root.path("sid").asText(null);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static void requireConfig(String value, String propertyName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing SMS config: " + propertyName);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String sanitizeError(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            message = e.getClass().getSimpleName();
        }
        return message.length() <= 1000 ? message : message.substring(0, 1000);
    }
}
