-- V57__candidate_files_and_experience.sql
-- Candidate page redesign (Phase 2A — backend): Files tab storage + cache
-- columns for AI-extracted Work Experience / Education.
-- ADDITIVE ONLY. Apply manually; do not run via Flyway auto-migration.

-- Mirrors client_files (V52__client_files.sql) — same BYTEA pattern, keyed
-- by candidate_id instead of client_id.
CREATE TABLE IF NOT EXISTS candidate_files (
    id            BIGSERIAL    PRIMARY KEY,
    login_id      TEXT         NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    candidate_id  TEXT         NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    file_name     TEXT         NOT NULL,
    content_type  TEXT,
    file_data     BYTEA        NOT NULL,
    uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_files_login_candidate ON candidate_files (login_id, candidate_id);

-- Cache for the new Work Experience / Education AI extraction — generated
-- once from the candidate's stored cv_text, then read from here on every
-- later page view (same cache-or-generate pattern as analyses.ai_summary_json).
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_experience_json JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education_json JSONB;
