-- V23__candidate_search_fields.sql
-- Adds structured search/filter fields to candidates for the Smart Talent Lens
-- candidates page: current role, location, experience, and preference fields
-- used for rule-based match scoring. All nullable — existing rows unaffected.

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_title TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS years_experience NUMERIC(4,1);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS seniority_level TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS expected_salary_min NUMERIC(12,2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS expected_salary_max NUMERIC(12,2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'AUD';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notice_period_weeks INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_rights TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS remote_flexible BOOLEAN DEFAULT false;
