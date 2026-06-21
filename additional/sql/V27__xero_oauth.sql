-- ============================================================
-- Migration: V27__xero_oauth.sql
-- Author: DBA Agent — Nolyvra
-- Date: 2026-06-21
-- Finding / Story: Xero Connection Foundation sprint (Connect to Xero OAuth2)
-- ============================================================
-- MANUAL EXECUTION REQUIRED
-- Pre-execution checklist:
--   [ ] Reviewed and approved by Sayan
--   [ ] Verified on staging environment first
--   [ ] Database backup taken before execution
--   [ ] Scheduled for low-traffic window (off-peak hours)
--   [ ] Rollback script prepared (see bottom of this file)
-- ============================================================

-- [TABLE: xero_connection]
-- Reason: Stores one row per (agency login, Xero tenant) so a recruitment
--   agency can later push invoices to the correct Xero organisation.
--   Mirrors the existing oauth_tokens pattern (see V10__oauth_tokens.sql)
--   but is a dedicated table because Xero is multi-tenant per connection
--   (tenant id/name resolved via the Xero /connections API) and these are
--   finance-system credentials, not just a mailbox token.
-- Tokens are stored in PLAIN TEXT, matching the existing oauth_tokens
--   table convention in this codebase (Sayan's explicit decision for this
--   sprint — no encryption utility currently exists in the app).
-- Risk: Low — new table, no impact on existing schema or queries.
-- Estimated execution time: < 1s (empty table, no data migration).
CREATE TABLE IF NOT EXISTS xero_connection (
    id               BIGSERIAL    PRIMARY KEY,
    login_id         TEXT         NOT NULL REFERENCES login(id),
    xero_tenant_id   TEXT         NOT NULL,
    xero_tenant_name TEXT,
    access_token     TEXT         NOT NULL,
    refresh_token    TEXT         NOT NULL,
    expires_at       TIMESTAMPTZ  NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_xero_connection_login_tenant UNIQUE (login_id, xero_tenant_id)
);

-- [INDEX: xero_connection.login_id]
-- Table: xero_connection
-- Column(s): login_id
-- Reason: Every read (status check, token refresh, disconnect) looks up
--   connections by login_id first. The UNIQUE constraint above already
--   creates a composite index on (login_id, xero_tenant_id), but that
--   composite index cannot efficiently serve a login_id-only lookup
--   (status endpoint doesn't know the tenant id ahead of time), so a
--   single-column index is added explicitly.
-- Risk: Low — small table, negligible write overhead.
-- Estimated execution time: < 1s (empty table).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xero_connection_login_id
    ON xero_connection (login_id);

-- ============================================================
-- ROLLBACK SCRIPT
-- Run this only if the migration causes issues:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_xero_connection_login_id;
-- DROP TABLE IF EXISTS xero_connection;
-- ============================================================
