-- V52__client_files.sql
-- Client detail popup: Files tab — upload/download/delete arbitrary files per client
-- ADDITIVE ONLY — no existing tables or columns are altered destructurally.
-- Apply manually; do not run via Flyway auto-migration.

CREATE TABLE IF NOT EXISTS client_files (
    id            BIGSERIAL    PRIMARY KEY,
    login_id      TEXT         NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    client_id     BIGINT       NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    file_name     TEXT         NOT NULL,
    content_type  TEXT,
    file_data     BYTEA        NOT NULL,
    uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_files_login_client ON client_files (login_id, client_id);
