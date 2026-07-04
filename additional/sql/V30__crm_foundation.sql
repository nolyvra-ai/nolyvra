-- V30__crm_foundation.sql
-- CRMx Sprint 1: Employee Foundation & Hired→Active Conversion (beta)
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

-- ─── 1. CRM module entitlement flag on login ──────────────────────────────
-- Defaults to true; all accounts have CRMx enabled by default (beta).
ALTER TABLE login ADD COLUMN IF NOT EXISTS crm_enabled BOOLEAN NOT NULL DEFAULT true;

-- ─── 2. Departments (tenant-scoped lookup) ────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
    id          TEXT        NOT NULL PRIMARY KEY,
    login_id    TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate department names per tenant (case-insensitive via LOWER in app layer)
CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_login_name
    ON departments (login_id, name) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_departments_login_id ON departments (login_id);

-- ─── 3. Employees ─────────────────────────────────────────────────────────
-- candidate_id is nullable: NULL = directly-added employee, SET = converted from ATS
-- manager_id is self-referencing: single-manager hierarchy, nullable
CREATE TABLE IF NOT EXISTS employees (
    id              TEXT        NOT NULL PRIMARY KEY,
    login_id        TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    candidate_id    TEXT                 REFERENCES candidates(id) ON DELETE SET NULL,
    first_name      VARCHAR(255) NOT NULL,
    last_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(320) NOT NULL,
    phone           VARCHAR(50),
    job_title       VARCHAR(255),
    employment_type TEXT        NOT NULL,           -- PERMANENT | CONTRACT | PLACED
    status          TEXT        NOT NULL DEFAULT 'ONBOARDING',  -- ONBOARDING | ACTIVE | INACTIVE
    manager_id      TEXT                 REFERENCES employees(id) ON DELETE SET NULL,
    department_id   TEXT                 REFERENCES departments(id) ON DELETE SET NULL,
    start_date      DATE,
    end_date        DATE,                           -- NULL = ongoing / permanent
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_login_id      ON employees (login_id);
CREATE INDEX IF NOT EXISTS idx_employees_candidate_id  ON employees (candidate_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id    ON employees (manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees (department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status        ON employees (status);

-- Idempotency guard: one employee per candidate per tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_candidate_login
    ON employees (login_id, candidate_id)
    WHERE candidate_id IS NOT NULL AND is_active = true;

UPDATE login SET crm_enabled = true;

-- ─── Rollback script (run manually if needed) ──────────────────────────────
-- DROP TABLE IF EXISTS employees;
-- DROP TABLE IF EXISTS departments;
-- ALTER TABLE login DROP COLUMN IF EXISTS crm_enabled;
