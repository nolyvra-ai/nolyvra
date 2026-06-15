CREATE INDEX IF NOT EXISTS idx_candidates_login_active_created_at
    ON candidates (login_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidates_login_job_active_created_at
    ON candidates (login_id, job_id, is_active, created_at DESC);
