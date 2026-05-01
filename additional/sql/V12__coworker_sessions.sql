-- ─── V12: CoWorker conversation sessions ──────────────────────────────────────

-- One row per named conversation thread per user
CREATE TABLE IF NOT EXISTS coworker_sessions (
    id              BIGSERIAL    PRIMARY KEY,
    login_id        TEXT         NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    title           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cw_sessions_login
    ON coworker_sessions(login_id, last_message_at DESC);

-- Link each message to a session (nullable so existing rows are not invalidated)
ALTER TABLE coworker_messages
    ADD COLUMN IF NOT EXISTS session_id BIGINT
        REFERENCES coworker_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cw_messages_session
    ON coworker_messages(session_id, created_at ASC);
