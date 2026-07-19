-- Secondary contacts for a client, beyond the existing primary
-- contact_person/contact_email/contact_title columns.
-- Each array entry: {"name": "...", "title": "...", "email": "..."}
ALTER TABLE clients ADD COLUMN secondary_contacts JSONB NOT NULL DEFAULT '[]'::jsonb;
