-- V73__email_verification_tokens.sql
-- One-time, time-limited email verification tokens for self-service signup.
-- Only a SHA-256 digest is stored; the token sent by email is never persisted.
-- Completing verification auto-onboards the account onto the free plan.
-- Apply manually; do not run via Flyway auto-migration.

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_hash TEXT        NOT NULL PRIMARY KEY,
    login_id   TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_login_id
    ON email_verification_tokens (login_id);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at
    ON email_verification_tokens (expires_at);

ALTER TABLE login ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
