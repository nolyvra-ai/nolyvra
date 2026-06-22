-- V29__candidate_company_other_fields.sql
-- Adds current_company (Employer) as a first-class column, and a catch-all
-- other_fields JSONB column to hold any spreadsheet columns that don't map
-- to a known candidate field today, so future import sources aren't lossy.

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_company TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS other_fields JSONB;
