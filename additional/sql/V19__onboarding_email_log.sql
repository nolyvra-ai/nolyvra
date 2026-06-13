CREATE TABLE IF NOT EXISTS onboarding_email_log (
    id                BIGSERIAL PRIMARY KEY,
    target_login_id   TEXT NOT NULL,
    recipient_email   TEXT,
    email_type        TEXT NOT NULL,
    status            TEXT NOT NULL,
    resend_id         TEXT,
    error_message     TEXT,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_email_log_created_at
    ON onboarding_email_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_email_log_target_login_id
    ON onboarding_email_log(target_login_id);
