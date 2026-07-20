-- V49__crm_timesheets.sql
-- CRMx Timesheets — weekly submission, admin approve/reject + analytics (beta)
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

-- ─── 1. Timesheet (one row per employee per submitted week) ──────────────
CREATE TABLE IF NOT EXISTS timesheet (
    id               TEXT         NOT NULL PRIMARY KEY,
    login_id         TEXT         NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    employee_id      TEXT         NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    week_start_date  DATE         NOT NULL,                    -- the Monday of the week
    total_hours      NUMERIC(6,2) NOT NULL DEFAULT 0,
    status           TEXT         NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED | CANCELLED
    approver_comment TEXT,
    actioned_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timesheet_login_id    ON timesheet (login_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_employee_id ON timesheet (employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_week_start  ON timesheet (week_start_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_status      ON timesheet (status);

-- ─── 2. Timesheet days (up to 7 rows per timesheet) ───────────────────────
-- Kept separate from `timesheet` (rather than 7 columns) so analytics can sum
-- hours over arbitrary date ranges (calendar month/year don't align to weeks).
CREATE TABLE IF NOT EXISTS timesheet_day (
    id           TEXT         NOT NULL PRIMARY KEY,
    timesheet_id TEXT         NOT NULL REFERENCES timesheet(id) ON DELETE CASCADE,
    work_date    DATE         NOT NULL,
    hours        NUMERIC(4,2) NOT NULL DEFAULT 0,
    note         TEXT,
    UNIQUE (timesheet_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_timesheet_day_timesheet_id ON timesheet_day (timesheet_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_day_work_date    ON timesheet_day (work_date);
