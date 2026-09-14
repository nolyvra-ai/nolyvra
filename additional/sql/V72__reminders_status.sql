-- V72__reminders_status.sql
-- Kanban-style status for the Reminders board (To Do / In Progress /
-- Awaiting Response / Done), replacing the previous purely-derived
-- date/is_completed buckets used by the old list UI. is_completed stays in
-- sync with status = 'Done' so existing auto-scan queries (which filter on
-- is_completed) keep working unchanged.
-- Apply manually; do not run via Flyway auto-migration.

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'To Do';

ALTER TABLE reminders ADD CONSTRAINT ck_reminders_status
    CHECK (status IN ('To Do', 'In Progress', 'Awaiting Response', 'Done'));

UPDATE reminders SET status = 'Done' WHERE is_completed = true AND status <> 'Done';

CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders (status);
