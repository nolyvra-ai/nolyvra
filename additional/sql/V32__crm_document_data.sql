-- V32__crm_document_data.sql
-- Adds file_data column to employee_document for base64-encoded file storage.
-- V31 defined file_ref as VARCHAR(1024) — that stores the UUID lookup key.
-- This column holds the actual file bytes (base64-encoded) so no external storage is needed.
-- Apply after V31.

ALTER TABLE employee_document ADD COLUMN IF NOT EXISTS file_data TEXT;

-- Rollback: ALTER TABLE employee_document DROP COLUMN IF EXISTS file_data;
