-- V24__candidate_skills.sql
-- Adds a structured skills list to candidates, populated from CV extraction
-- at candidate creation time. Stored as JSONB array of strings, e.g. ["Java","AWS"].

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS skills JSONB;
CREATE INDEX IF NOT EXISTS idx_candidates_skills ON candidates USING gin(skills);
