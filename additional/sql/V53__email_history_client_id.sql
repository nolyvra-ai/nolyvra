-- V53__email_history_client_id.sql
-- Client detail popup: link emails sent from a client's "Send Email" button
-- directly to that client, so the Related Emails tab doesn't rely solely on
-- matching the recipient address against the client's stored contact emails
-- (which misses emails sent to an address not yet saved on the client).
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

ALTER TABLE email_history ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_history_client_id ON email_history (client_id);
