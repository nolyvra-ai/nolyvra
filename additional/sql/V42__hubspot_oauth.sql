-- ============================================================
-- Migration: V42__hubspot_oauth.sql
-- Author: DBA Agent — Nolyvra
-- Date: 2026-07-11
-- Finding / Story: HubSpot Connection Foundation sprint
-- ============================================================
-- MANUAL EXECUTION REQUIRED
-- Pre-execution checklist:
--   [ ] Reviewed and approved by Sayan
--   [ ] Verified on staging environment first
--   [ ] Database backup taken before execution
--   [ ] Scheduled for low-traffic window (off-peak hours)
--   [ ] Rollback script prepared (see bottom of this file)
-- ============================================================

-- [TABLE: hubspot_connection]
-- Reason: Stores one active HubSpot OAuth connection per agency login so
--   Nolyvra can manually push CRM records into the connected HubSpot portal.
--   This mirrors the Xero connection foundation but HubSpot is portal-scoped
--   rather than tenant-scoped.
-- Tokens are stored in PLAIN TEXT to match the existing Xero/oauth_tokens
--   convention in this codebase. No encryption utility exists yet.
-- Risk: Low — new table, no impact on existing schema or queries.
-- Estimated execution time: < 1s (empty table).
CREATE TABLE IF NOT EXISTS hubspot_connection (
    id                    BIGSERIAL    PRIMARY KEY,
    login_id              TEXT         NOT NULL REFERENCES login(id),
    hubspot_portal_id     TEXT,
    hubspot_portal_name   TEXT,
    hubspot_user_email    TEXT,
    access_token          TEXT         NOT NULL,
    refresh_token         TEXT         NOT NULL,
    expires_at            TIMESTAMPTZ  NOT NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_hubspot_connection_login UNIQUE (login_id)
);

-- [INDEX: hubspot_connection.login_id]
-- Table: hubspot_connection
-- Column(s): login_id
-- Reason: Status checks, token refresh, and disconnect all look up the
--   HubSpot connection by agency login.
-- Risk: Low — small table, negligible write overhead.
-- Estimated execution time: < 1s (empty table).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hubspot_connection_login_id
    ON hubspot_connection (login_id);

-- ============================================================
-- ROLLBACK SCRIPT
-- Run this only if the migration causes issues:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_hubspot_connection_login_id;
-- DROP TABLE IF EXISTS hubspot_connection;
-- ============================================================
