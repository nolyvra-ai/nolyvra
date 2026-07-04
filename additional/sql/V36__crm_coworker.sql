-- CRMx Co-worker: separate chat session and message tables (independent of ATS coworker)

CREATE TABLE IF NOT EXISTS crm_coworker_sessions (
    id              BIGSERIAL    PRIMARY KEY,
    login_id        TEXT         NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    title           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_cw_sessions_login
    ON crm_coworker_sessions(login_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS crm_coworker_messages (
    id         BIGSERIAL    PRIMARY KEY,
    login_id   TEXT         NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    session_id BIGINT       NOT NULL REFERENCES crm_coworker_sessions(id) ON DELETE CASCADE,
    role       TEXT         NOT NULL,
    content    TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_cw_messages_session
    ON crm_coworker_messages(session_id, created_at ASC);
