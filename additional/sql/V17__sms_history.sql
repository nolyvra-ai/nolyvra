-- V17__sms_history.sql
-- Stores outbound SMS attempts and provider delivery metadata.

CREATE TABLE IF NOT EXISTS sms_history (
    id                  BIGSERIAL   PRIMARY KEY,
    candidate_id        TEXT        REFERENCES candidates(id) ON DELETE SET NULL,
    login_id            TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    to_number           TEXT        NOT NULL,
    body                TEXT        NOT NULL,
    template_type       TEXT,
    provider            TEXT        NOT NULL,
    status              TEXT        NOT NULL DEFAULT 'Sent',
    provider_message_id TEXT,
    error_message       TEXT,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_history_candidate_id ON sms_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_sms_history_login_id     ON sms_history(login_id);
CREATE INDEX IF NOT EXISTS idx_sms_history_sent_at      ON sms_history(sent_at DESC);
