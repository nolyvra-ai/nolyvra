-- V60__password_reset_tokens.sql
-- One-time, time-limited password reset tokens for tenant accounts.
-- Only a SHA-256 digest is stored; the token sent by email is never persisted.
-- Apply manually; do not run via Flyway auto-migration.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT        NOT NULL PRIMARY KEY,
    login_id   TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_login_id
    ON password_reset_tokens (login_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
    ON password_reset_tokens (expires_at);
