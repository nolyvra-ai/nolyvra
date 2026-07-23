-- V54__contacts.sql
-- Contacts: a new person-level entity linked to Clients, with Lead/Client status
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

-- ─── 1. Lead vs. Client status on the clients row itself ──────────────────
-- Every existing row defaults to CLIENT (they're all real clients today).
-- A "lead" is just a clients row with status = 'LEAD' — created when someone
-- adds a Contact from a Potential Client before that company is formally
-- added as a client. Converting later flips this same row to CLIENT.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'CLIENT';

-- ─── 2. Contacts (first-class, FK to clients — not the JSONB secondary_contacts) ──
CREATE TABLE IF NOT EXISTS contacts (
    id            BIGSERIAL    PRIMARY KEY,
    login_id      TEXT         NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    client_id     BIGINT       NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name          TEXT         NOT NULL,
    title         TEXT,
    email         TEXT,
    phone         TEXT,
    linkedin_url  TEXT,
    facebook_url  TEXT,
    twitter_url   TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_login_client ON contacts (login_id, client_id);
