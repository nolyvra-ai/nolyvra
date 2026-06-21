-- ============================================================
-- Migration: V28__xero_invoice.sql
-- Author: DBA Agent — Nolyvra
-- Date: 2026-06-21
-- Finding / Story: Create Xero Invoice sprint (on top of Xero Connection Foundation, V27)
-- ============================================================
-- MANUAL EXECUTION REQUIRED
-- Pre-execution checklist:
--   [ ] Reviewed and approved by Sayan
--   [ ] Verified on staging environment first
--   [ ] Database backup taken before execution
--   [ ] Scheduled for low-traffic window (off-peak hours)
--   [ ] Rollback script prepared (see bottom of this file)
-- ============================================================

-- [TABLE: xero_invoice]
-- Reason: Records one row per invoice raised in Xero from Nolyvra, so the
--   app can show invoice status/total without re-calling the Xero API, and
--   so jobs.xero_invoice_id has something to reference. Keyed by login_id
--   to match how xero_connection (V27) and clients are scoped per agency.
-- Risk: Low — new table, no impact on existing schema or queries.
-- Estimated execution time: < 1s (empty table).
CREATE TABLE IF NOT EXISTS xero_invoice (
    id                  BIGSERIAL    PRIMARY KEY,
    login_id            TEXT         NOT NULL REFERENCES login(id),
    client_id           BIGINT       NOT NULL REFERENCES clients(id),
    xero_invoice_id     TEXT         NOT NULL,
    xero_invoice_number TEXT,
    status               TEXT        NOT NULL,
    currency             TEXT        NOT NULL,
    total                NUMERIC(12,2) NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- [INDEX: xero_invoice(login_id, client_id)]
-- Table: xero_invoice
-- Column(s): login_id, client_id
-- Reason: Status/list queries for "invoices raised for this client" filter
--   on both columns together (agency scope + client scope), same shape as
--   the existing /api/clients/{id}/jobs lookup pattern.
-- Risk: Low — small table, negligible write overhead.
-- Estimated execution time: < 1s (empty table).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xero_invoice_login_client
    ON xero_invoice (login_id, client_id);

-- [COLUMN: jobs.xero_invoice_id]
-- Table: jobs
-- Reason: Stamping a job with the xero_invoice row it was billed under
--   drives the "already invoiced" idempotency check in the billable-
--   placements query (WHERE xero_invoice_id IS NULL) and the UI's
--   invoiced/not-invoiced state. Nullable — most jobs are never invoiced.
-- Risk: Low — additive nullable column on an existing table, no rewrite
--   of existing rows required (default NULL).
-- Estimated execution time: Fast on Postgres 11+ (nullable column add
--   is metadata-only, no table rewrite).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS xero_invoice_id BIGINT REFERENCES xero_invoice(id);

-- [COLUMN: jobs.invoiced_at]
-- Table: jobs
-- Reason: Timestamp companion to xero_invoice_id, used for UI display
--   ("Invoiced on ...") without joining to xero_invoice.created_at.
-- Risk: Low — additive nullable column, metadata-only add.
-- Estimated execution time: Fast (nullable column add, no table rewrite).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- [INDEX: jobs.xero_invoice_id]
-- Table: jobs
-- Column(s): xero_invoice_id
-- Reason: FK column with no supporting index. Queried both ways: the
--   billable-placements lookup filters WHERE xero_invoice_id IS NULL,
--   and reconciliation/debugging will look up jobs by xero_invoice_id.
-- Risk: Low — negligible write overhead, jobs table already has other
--   indexes (see V20__candidate_list_indexes.sql) without issue.
-- Estimated execution time: Depends on existing jobs row count — low
--   thousands of rows expected at this stage, should complete in seconds.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_xero_invoice_id
    ON jobs (xero_invoice_id);

-- ============================================================
-- ROLLBACK SCRIPT
-- Run this only if the migration causes issues:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_jobs_xero_invoice_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS invoiced_at;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS xero_invoice_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_xero_invoice_login_client;
-- DROP TABLE IF EXISTS xero_invoice;
-- ============================================================
