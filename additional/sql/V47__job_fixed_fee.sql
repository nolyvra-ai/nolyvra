-- Allows a job's recruitment fee to be a flat amount instead of a % of salary.
ALTER TABLE jobs ADD COLUMN fee_type TEXT NOT NULL DEFAULT 'PERCENTAGE';
ALTER TABLE jobs ADD COLUMN fixed_fee NUMERIC(12,2);
