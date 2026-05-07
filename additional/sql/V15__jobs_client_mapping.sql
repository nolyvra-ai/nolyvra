-- V15__jobs_client_mapping.sql
-- Migrate distinct companies from the existing jobs table into the new clients table.
-- Only inserts companies not already present; pulls location alongside company_name.

INSERT INTO clients (login_id, company_name, location)
SELECT DISTINCT ON (j.login_id, lower(j.company))
    j.login_id,
    j.company,
    j.location
FROM jobs j
WHERE j.company IS NOT NULL
  AND j.company <> ''
  AND NOT EXISTS (
      SELECT 1 FROM clients c
      WHERE c.login_id = j.login_id
        AND lower(c.company_name) = lower(j.company)
  );
