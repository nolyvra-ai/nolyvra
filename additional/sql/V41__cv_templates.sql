-- ─── CV Templates (Format CV feature) ────────────────────────────────────────
-- Recruiters upload a .docx CV template containing merge-field placeholders
-- (e.g. ${name}, ${cvBody}) once, then reuse it to stamp candidate data into
-- the real template file — preserving its exact formatting.

CREATE TABLE IF NOT EXISTS cv_templates (
    id              TEXT        PRIMARY KEY,
    login_id        TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    file_name       TEXT,
    docx_data       BYTEA       NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cv_templates_login_id ON cv_templates(login_id);
