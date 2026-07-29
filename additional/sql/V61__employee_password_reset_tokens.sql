-- V61__employee_password_reset_tokens.sql
-- One-time, time-limited password reset tokens for employee accounts.
-- Employee tokens are kept separate from tenant tokens to prevent account-type
-- confusion when the same email address exists in both account domains.
-- Apply manually; do not run via Flyway auto-migration.

CREATE TABLE IF NOT EXISTS employee_password_reset_tokens (
    token_hash  TEXT        NOT NULL PRIMARY KEY,
    employee_id TEXT        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_employee_password_reset_tokens_employee_id
    ON employee_password_reset_tokens (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_password_reset_tokens_expires_at
    ON employee_password_reset_tokens (expires_at);
