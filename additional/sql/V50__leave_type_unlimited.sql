-- V50__leave_type_unlimited.sql
-- Leave / Work From Home: leave types can be marked unlimited (no days/year cap)
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

ALTER TABLE leave_type ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN NOT NULL DEFAULT false;
