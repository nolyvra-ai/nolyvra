-- V51__client_profile_fields.sql
-- Client detail popup: expanded company profile fields
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS website        TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS facebook_url    TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS twitter_url     TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS about_company   TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_address    TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS locality        TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state           TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS country         TEXT;
