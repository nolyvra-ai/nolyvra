-- V71__interview_sessions.sql
-- Async audio interview: one tokenised, time-limited session per
-- (candidate, job_application). Only a SHA-256 digest of the public link
-- token is stored, mirroring password_reset_tokens (V60). Starting or
-- regenerating an interview deletes the prior row for the same pair first,
-- so at most one session (and one valid link) ever exists at a time.
-- Apply manually; do not run via Flyway auto-migration.

CREATE TABLE IF NOT EXISTS interview_session (
    id                           TEXT         PRIMARY KEY,
    login_id                     TEXT         NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    candidate_id                 TEXT         NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_application_id           TEXT         NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
    token_hash                   TEXT         NOT NULL,
    token_expires_at             TIMESTAMPTZ  NOT NULL,
    questions_snapshot           JSONB        NOT NULL,
    status                       TEXT         NOT NULL DEFAULT 'SENT',
    transcript                   TEXT,
    consent_at                   TIMESTAMPTZ,
    invitation_email_history_id  BIGINT       REFERENCES email_history(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at                 TIMESTAMPTZ,
    updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_interview_session_candidate_application UNIQUE (candidate_id, job_application_id),
    CONSTRAINT uq_interview_session_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_interview_session_status CHECK (status IN ('SENT','STARTED','COMPLETED','ANALYSED','EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_interview_session_login_id
    ON interview_session (login_id);

CREATE INDEX IF NOT EXISTS idx_interview_session_token_hash
    ON interview_session (token_hash);
