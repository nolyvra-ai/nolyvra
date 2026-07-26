package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.NexusIntegrationEventRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

// Drains nexus_outbox_event and delivers each row to Nexus's
// POST /api/v1/integration/events, HMAC-signed. Same polling/backoff shape as
// AnalysisJobService's existing worker (AtomicBoolean overlap guard, poll-then-
// process-then-reschedule-on-failure). Retry cadence mirrors what Nexus's own
// WebhookDispatcher documents for its side: 30s/1m/2m/4m/8m, then a steady
// 15-minute cadence — deliberately no terminal "gave up" state, since a Nexus
// endpoint being down is never assumed permanent.
@Service
public class NexusOutboxDispatcher {

    private static final int MAX_BACKOFF_ATTEMPTS = 5;
    private static final long STEADY_RETRY_SECONDS = 15 * 60;

    private final JdbcTemplate jdbc;
    private final NexusClient nexusClient;
    private final WebhookSignatureService webhookSignatureService;
    private final ObjectMapper objectMapper;
    private final AtomicBoolean dispatchRunning = new AtomicBoolean(false);

    public NexusOutboxDispatcher(
            JdbcTemplate jdbc,
            NexusClient nexusClient,
            WebhookSignatureService webhookSignatureService,
            ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.nexusClient = nexusClient;
        this.webhookSignatureService = webhookSignatureService;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedDelayString = "${nexus.outbox.dispatch-delay-ms:15000}")
    public void dispatchPending() {
        if (!nexusClient.isConfigured()) return;
        if (!dispatchRunning.compareAndSet(false, true)) return;
        try {
            List<OutboxRow> rows = jdbc.query("""
                    select id, event_type, identity_token, tenant_ref, stage, occurred_at, attempts
                    from nexus_outbox_event
                    where status = 'PENDING' and next_attempt_at <= now()
                    order by created_at asc
                    limit 20
                    """,
                    (rs, rowNum) -> new OutboxRow(
                            rs.getString("id"),
                            rs.getString("event_type"),
                            rs.getString("identity_token"),
                            rs.getString("tenant_ref"),
                            rs.getString("stage"),
                            rs.getObject("occurred_at", OffsetDateTime.class),
                            rs.getInt("attempts")));
            System.out.println("[NexusOutboxDispatcher] poll found " + rows.size() + " pending row(s)");
            rows.forEach(this::dispatchOne);
        } finally {
            dispatchRunning.set(false);
        }
    }

    private void dispatchOne(OutboxRow row) {
        try {
            NexusIntegrationEventRequest payload = new NexusIntegrationEventRequest(
                    row.id(), row.eventType(), row.identityToken(), row.tenantRef(),
                    row.stage(), row.occurredAt().toInstant());
            byte[] rawBody = objectMapper.writeValueAsBytes(payload);
            String signature = webhookSignatureService.sign(rawBody);
            nexusClient.postIntegrationEvent(rawBody, signature);
            jdbc.update("""
                    update nexus_outbox_event
                    set status = 'DELIVERED', delivered_at = now()
                    where id = ?::uuid
                    """, row.id());
            System.out.println("[NexusOutboxDispatcher] delivered " + row.id() + " eventType=" + row.eventType()
                    + " identityToken=" + row.identityToken() + " tenantRef=" + row.tenantRef());
        } catch (Exception e) {
            int nextAttempts = row.attempts() + 1;
            long delaySeconds = nextAttempts <= MAX_BACKOFF_ATTEMPTS
                    ? (long) (30 * Math.pow(2, nextAttempts - 1))
                    : STEADY_RETRY_SECONDS;
            System.err.println("[NexusOutboxDispatcher] delivery failed for " + row.id()
                    + " (attempt " + nextAttempts + "), retrying in " + delaySeconds + "s: " + e.getMessage());
            jdbc.update("""
                    update nexus_outbox_event
                    set attempts = ?, next_attempt_at = now() + (? || ' seconds')::interval
                    where id = ?::uuid
                    """, nextAttempts, delaySeconds, row.id());
        }
    }

    private record OutboxRow(
            String id, String eventType, String identityToken, String tenantRef,
            String stage, OffsetDateTime occurredAt, int attempts) {}
}
