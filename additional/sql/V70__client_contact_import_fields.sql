-- V70__client_contact_import_fields.sql
-- New fields needed to support the Ross Recruitment client/contact data
-- import (Loxo "Contact" export) and, going forward, richer contact profiles
-- generally.
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

-- ─── clients: company-level ────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS zip TEXT;

-- ─── contacts: person-level ────────────────────────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS personal_email TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS work_email     TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS other_email    TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS personal_phone TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS work_phone     TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mobile_phone   TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS meetup_url     TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS github_url     TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram_url  TEXT;
