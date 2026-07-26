package com.nolyvra.app.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

// Dedup/audit for inbound Nexus webhook events. See docs/nexus-integration/shared-contracts.md —
// retry/backoff on Nexus's side means at-least-once delivery, so every eventId
// must be recorded exactly once and replays must no-op.
@Service
public class NexusInboundEventService {

    private final JdbcTemplate jdbc;

    public NexusInboundEventService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // Returns true if this eventId was new (now recorded); false if it's a
    // replay already seen — an idempotent no-op either way from the caller's view.
    public boolean recordIfNew(String eventId, String eventType) {
        int inserted = jdbc.update("""
                insert into nexus_inbound_event (event_id, event_type)
                values (?::uuid, ?)
                on conflict (event_id) do nothing
                """, eventId, eventType);
        return inserted > 0;
    }
}
