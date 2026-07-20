-- V48__employee_login.sql
-- CRMx Employee Self-Service Login (beta)
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

-- ─── 1. Password on employees ─────────────────────────────────────────────
-- Same SHA-256("Welcome1") hash already used for tenant onboarding
-- (see UserService.DEFAULT_PASSWORD_HASH) — backfills existing rows too,
-- so every employee (past and future) can log in with the default password
-- until they change it.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL
    DEFAULT '7e19e31ae82d749034fc921f777f717ba5b57c6add9add889eb536ac6effcde0';

-- ─── 2. Employee sessions (mirrors user_sessions) ─────────────────────────
CREATE TABLE IF NOT EXISTS employee_sessions (
    token       UUID        NOT NULL PRIMARY KEY,
    employee_id TEXT        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    login_id    TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_employee_sessions_employee_id ON employee_sessions (employee_id);
