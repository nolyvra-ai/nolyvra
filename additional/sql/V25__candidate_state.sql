-- V25__candidate_state.sql
-- Adds a state/province field to candidates, shown alongside location as
-- "City, State" on the Smart Talent Lens candidates page.

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS state TEXT;
