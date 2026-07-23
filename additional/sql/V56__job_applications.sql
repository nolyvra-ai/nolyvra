-- V56__job_applications.sql
-- Candidate <-> Job Application split: one candidate (person) can now have
-- many job_applications (one per job they've applied to), instead of a
-- candidates row being 1:1 with a job.
--
-- ADDITIVE ONLY — candidates.job_id / stage / interview_questions are left in
-- place, deprecated but untouched. They are not read or written by any new
-- code after this migration; dropping them is a separate follow-up cleanup
-- migration once the new model is confirmed solid in production.
-- Apply manually; do not run via Flyway auto-migration.

CREATE TABLE IF NOT EXISTS job_applications (
    id                   TEXT         PRIMARY KEY,
    login_id             TEXT         NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    candidate_id         TEXT         NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id               TEXT         NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    stage                TEXT         NOT NULL DEFAULT 'Screening',
    interview_questions  TEXT,
    is_active            BOOLEAN      NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_applications_login_candidate ON job_applications (login_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_login_job       ON job_applications (login_id, job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_is_active       ON job_applications (is_active);

-- Lets activity events be tagged with which application they belong to, so a
-- person's unified activity feed can still show "Applied to Job A" vs
-- "Applied to Job B" distinctly. Nullable — existing events predate this.
ALTER TABLE activity_timeline ADD COLUMN IF NOT EXISTS job_id TEXT REFERENCES jobs(id);
