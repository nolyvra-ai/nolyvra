-- V64__grievance_entitlement.sql
-- Per-tenant toggle to hide the Grievances feature within CRMx (e.g. Hyperon
-- does not want their employees to see the Grievances tab).
-- Defaults to true; all accounts have Grievances enabled by default.
-- Apply manually; do not run via Flyway auto-migration.

ALTER TABLE login ADD COLUMN IF NOT EXISTS grievance_enabled BOOLEAN NOT NULL DEFAULT true;
