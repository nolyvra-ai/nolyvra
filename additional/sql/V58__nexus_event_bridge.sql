-- V58__nexus_event_bridge.sql
-- Nolyvra <-> Nexus integration, Step 6: event bridge storage.
-- ADDITIVE ONLY. Apply manually; do not run via Flyway auto-migration.
--
-- Two tables, one per direction. Neither has an FK to any existing table —
-- identity_token/tenant_ref are opaque strings, not references. This app
-- never stores a Nexus candidateId locally, by design: the two systems
-- never share a database (see docs/nexus-integration/shared-contracts.md).

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- Outbound queue: pipeline events waiting to be delivered to Nexus
-- (POST /api/v1/integration/events, HMAC-signed, retried with backoff by
-- NexusOutboxDispatcher). One row per event, written by
-- NexusPipelineEventPublisher at the moment a candidate is added to a
-- pipeline or changes stage.
CREATE TABLE IF NOT EXISTS nexus_outbox_event (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      TEXT         NOT NULL, -- candidate.added_to_pipeline | candidate.stage_changed | candidate.removed_from_pipeline | candidate.placed
    identity_token  TEXT         NOT NULL, -- HMAC-SHA256(lowercase(trim(email)), IDENTITY_TOKEN_SECRET), computed at write time
    tenant_ref      TEXT         NOT NULL, -- this app's loginId
    stage           TEXT,                  -- set only for candidate.stage_changed
    occurred_at     TIMESTAMPTZ  NOT NULL,
    status          TEXT         NOT NULL DEFAULT 'PENDING', -- PENDING | DELIVERED
    attempts        INT          NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    delivered_at    TIMESTAMPTZ
);

-- Supports the dispatcher's poll query: WHERE status = 'PENDING' AND next_attempt_at <= now()
CREATE INDEX IF NOT EXISTS idx_nexus_outbox_event_status_next_attempt
    ON nexus_outbox_event (status, next_attempt_at);

-- Inbound dedup/audit log: every eventId Nexus has sent us, verified by HMAC
-- signature (over the raw request body) before this table is ever touched.
-- event_id is Nexus's own id — the idempotency key for message.received /
-- consent.granted / endorsement.completed. No default: always app-supplied
-- from the inbound payload, never generated here.
CREATE TABLE IF NOT EXISTS nexus_inbound_event (
    event_id      UUID         PRIMARY KEY,
    event_type    TEXT         NOT NULL,
    received_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    processed_at  TIMESTAMPTZ
);
