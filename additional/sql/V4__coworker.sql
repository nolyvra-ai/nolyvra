-- ─── V4: CoWorker AI tables ───────────────────────────────────────────────────

-- Stores each task the CoWorker starts (analysis, scheduling, pipeline etc.)
CREATE TABLE IF NOT EXISTS coworker_tasks (
    id           BIGSERIAL    PRIMARY KEY,
    login_id     TEXT         NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    task_type    TEXT         NOT NULL, -- RUN_ANALYSIS | SCHEDULE_INTERVIEW | MOVE_PIPELINE | EMAIL | CREATE_REMINDER
    description  TEXT,
    status       TEXT         NOT NULL DEFAULT 'pending', -- pending | running | done | failed
    progress     INT          NOT NULL DEFAULT 0,         -- 0-100
    result_json  JSONB,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_coworker_tasks_login ON coworker_tasks(login_id);
CREATE INDEX IF NOT EXISTS idx_coworker_tasks_status ON coworker_tasks(login_id, status);

-- Stores the chat message history per user (for conversation context)
CREATE TABLE IF NOT EXISTS coworker_messages (
    id         BIGSERIAL   PRIMARY KEY,
    login_id   TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    role       TEXT        NOT NULL, -- user | assistant
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coworker_messages_login ON coworker_messages(login_id, created_at DESC);
