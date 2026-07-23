-- V55__contact_candidate_link.sql
-- Link a Client Contact to a Candidate record ("Link to Candidate" button)
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_client BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS candidate_id TEXT REFERENCES candidates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_candidate_id ON contacts (candidate_id);
