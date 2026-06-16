-- V21: Add phone_number to candidates table

ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Rollback:
-- ALTER TABLE candidates DROP COLUMN IF EXISTS phone_number;
