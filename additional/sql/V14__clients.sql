CREATE TABLE clients (
    id                   BIGSERIAL PRIMARY KEY,
    login_id             TEXT NOT NULL,
    company_name         TEXT NOT NULL,
    industry             TEXT,
    company_size         TEXT,
    location             TEXT,
    contact_person       TEXT,
    contact_email        TEXT,
    contact_title        TEXT,
    linkedin_url         TEXT,
    notes                TEXT,
    last_funding_event   TEXT,
    last_funding_amount  TEXT,
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clients_login_id ON clients (login_id);
CREATE INDEX idx_clients_company  ON clients (lower(company_name));
