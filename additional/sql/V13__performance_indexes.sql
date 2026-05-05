CREATE INDEX IF NOT EXISTS idx_interviews_login_scheduled_active
    ON interviews (login_id, scheduled_at)
    WHERE status = 'Scheduled';

CREATE INDEX IF NOT EXISTS idx_analyses_login_analyzed_at
    ON analyses (login_id, analyzed_at DESC);
