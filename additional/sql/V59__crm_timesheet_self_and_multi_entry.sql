-- V59__crm_timesheet_self_and_multi_entry.sql
-- CRMx Timesheets: tenant self-service + multiple entries per day (beta)
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

-- ─── 1. Link the tenant/account-holder login to their own employee record ─
-- Lets the Nolyvra account holder submit and approve their own timesheet
-- through the existing employee-scoped timesheet flow.
ALTER TABLE login ADD COLUMN IF NOT EXISTS owner_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL;

-- ─── 2. Allow multiple timesheet_day rows for the same date ──────────────
-- Lets users split a day's hours across multiple lines (e.g. different
-- tasks/projects), each with its own note.
ALTER TABLE timesheet_day DROP CONSTRAINT IF EXISTS timesheet_day_timesheet_id_work_date_key;

-- ─── Rollback script (run manually if needed) ──────────────────────────────
-- ALTER TABLE timesheet_day ADD CONSTRAINT timesheet_day_timesheet_id_work_date_key UNIQUE (timesheet_id, work_date);
-- ALTER TABLE login DROP COLUMN IF EXISTS owner_employee_id;
