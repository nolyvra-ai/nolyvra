-- ============================================================
-- Migration: V43__external_crm_link.sql
-- Date: 2026-07-12
-- Story: HubSpot CRM Link Tracking
-- ============================================================
-- MANUAL EXECUTION REQUIRED
-- Pre-execution checklist:
--   [ ] Reviewed and approved
--   [ ] Verified on staging environment first
--   [ ] Database backup taken before execution
-- ============================================================

-- Stores provider-neutral links between Nolyvra records and external CRM
-- objects. local_id is text because Nolyvra object identifiers use both
-- numeric and string representations.
CREATE TABLE IF NOT EXISTS external_crm_link (
    id                BIGSERIAL    PRIMARY KEY,
    login_id          TEXT         NOT NULL REFERENCES login(id),
    provider          TEXT         NOT NULL,
    local_type        TEXT         NOT NULL,
    local_id          TEXT         NOT NULL,
    external_id       TEXT,
    external_url      TEXT,
    last_synced_at    TIMESTAMPTZ,
    last_sync_status  TEXT         NOT NULL,
    last_sync_error   TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_external_crm_link_local
        UNIQUE (login_id, provider, local_type, local_id),
    CONSTRAINT chk_external_crm_link_status
        CHECK (last_sync_status IN ('success', 'failed'))
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_external_crm_link_external
    ON external_crm_link (login_id, provider, external_id);

-- ============================================================
-- ROLLBACK SCRIPT
-- DROP INDEX CONCURRENTLY IF EXISTS idx_external_crm_link_external;
-- DROP TABLE IF EXISTS external_crm_link;
-- ============================================================
