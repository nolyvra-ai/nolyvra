CREATE TABLE IF NOT EXISTS register_interest_notification_log (
    id              BIGSERIAL PRIMARY KEY,
    submitted_email TEXT NOT NULL,
    recipient_email TEXT,
    status          TEXT NOT NULL,
    resend_id       TEXT,
    error_message   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_register_interest_notification_log_created_at
    ON register_interest_notification_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_register_interest_notification_log_submitted_email
    ON register_interest_notification_log(submitted_email);
