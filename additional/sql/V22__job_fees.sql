-- V22__job_fees.sql
-- Adds salary, currency and recruiter fee percentage to jobs.
-- estimated_fee is intentionally NOT stored — it is always computed as
-- salary * fee_percentage / 100 in the application layer to avoid drift.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'AUD';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fee_percentage NUMERIC(5,2);
