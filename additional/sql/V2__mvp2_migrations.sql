-- ============================================================
-- DeepHire MVP2 — Database Migration
-- Run after V1 (existing tables: login, jobs, candidates, analyses)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ALTER existing tables
-- ─────────────────────────────────────────────────────────────

-- candidates: add pipeline stage + recruiter notes
ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'Screening',
    ADD COLUMN IF NOT EXISTS recruiter_notes TEXT;

-- jobs: add status + raw client brief storage
ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active',
    ADD COLUMN IF NOT EXISTS brief_text TEXT;

-- analyses: add three new AI output columns (lazy-populated on first request)
ALTER TABLE analyses
    ADD COLUMN IF NOT EXISTS ai_summary_json        JSONB,
    ADD COLUMN IF NOT EXISTS fraud_signals_json     JSONB,
    ADD COLUMN IF NOT EXISTS placement_prob_json    JSONB;

-- ─────────────────────────────────────────────────────────────
-- 2. activity_timeline
--    Stores every system event + manual recruiter notes per candidate
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_timeline (
    id           BIGSERIAL PRIMARY KEY,
    candidate_id TEXT        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    login_id     TEXT        NOT NULL REFERENCES login(id)      ON DELETE CASCADE,
    event_type   TEXT        NOT NULL,
    -- CANDIDATE_ADDED | ANALYSIS_RUN | STAGE_CHANGED | EMAIL_SENT
    -- INTERVIEW_SCHEDULED | NOTE_ADDED | MESSAGE_GENERATED
    event_data   JSONB,
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_candidate_id ON activity_timeline(candidate_id);
CREATE INDEX IF NOT EXISTS idx_activity_login_id     ON activity_timeline(login_id);
CREATE INDEX IF NOT EXISTS idx_activity_event_type   ON activity_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_created_at   ON activity_timeline(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. interviews
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interviews (
    id               TEXT        PRIMARY KEY,
    candidate_id     TEXT        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id           TEXT        NOT NULL REFERENCES jobs(id)       ON DELETE CASCADE,
    login_id         TEXT        NOT NULL REFERENCES login(id)      ON DELETE CASCADE,
    interviewer      TEXT,
    interview_type   TEXT,           -- Technical | HR | Final Round | Casual Chat
    scheduled_at     TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER     DEFAULT 60,
    location         TEXT,           -- Google Meet | In Office | Zoom | Phone
    meeting_link     TEXT,
    notes            TEXT,
    status           TEXT        NOT NULL DEFAULT 'Scheduled',
    -- Scheduled | Completed | Cancelled
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id  ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_login_id      ON interviews(login_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at  ON interviews(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_status        ON interviews(status);

-- ─────────────────────────────────────────────────────────────
-- 4. email_history
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_history (
    id            BIGSERIAL   PRIMARY KEY,
    candidate_id  TEXT        REFERENCES candidates(id) ON DELETE SET NULL,
    login_id      TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    to_address    TEXT        NOT NULL,
    subject       TEXT        NOT NULL,
    body          TEXT        NOT NULL,
    template_type TEXT,       -- INTERVIEW_INVITE | FOLLOW_UP | REJECTION | OFFER
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    status        TEXT        NOT NULL DEFAULT 'Sent'    -- Sent | Failed
);

CREATE INDEX IF NOT EXISTS idx_email_history_candidate_id ON email_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_history_login_id     ON email_history(login_id);
CREATE INDEX IF NOT EXISTS idx_email_history_sent_at      ON email_history(sent_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. email_templates
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
    id            BIGSERIAL   PRIMARY KEY,
    login_id      TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    template_type TEXT        NOT NULL,
    -- INTERVIEW_INVITE | FOLLOW_UP | REJECTION | OFFER
    name          TEXT        NOT NULL,
    subject       TEXT        NOT NULL,
    body          TEXT        NOT NULL,
    is_default    BOOLEAN     DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_login_id ON email_templates(login_id);

-- ─────────────────────────────────────────────────────────────
-- 6. reminders
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
    id             BIGSERIAL   PRIMARY KEY,
    login_id       TEXT        NOT NULL REFERENCES login(id)      ON DELETE CASCADE,
    candidate_id   TEXT        REFERENCES candidates(id)          ON DELETE SET NULL,
    title          TEXT        NOT NULL,
    description    TEXT,
    reminder_type  TEXT        NOT NULL DEFAULT 'MANUAL',
    -- MANUAL | AUTO_ANALYSIS_PENDING | AUTO_SCREENING_STUCK
    -- AUTO_INTERVIEW_UPCOMING | AUTO_FOLLOWUP_PENDING
    priority       TEXT        NOT NULL DEFAULT 'Normal', -- Low | Normal | High
    due_at         TIMESTAMPTZ NOT NULL,
    is_completed   BOOLEAN     NOT NULL DEFAULT false,
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_login_id     ON reminders(login_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_at       ON reminders(due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_is_completed ON reminders(is_completed);
CREATE INDEX IF NOT EXISTS idx_reminders_candidate_id ON reminders(candidate_id);

ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_candidates_is_active ON candidates(is_active);

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);

-- 1. Create plans table
CREATE TABLE IF NOT EXISTS plans (
    id             VARCHAR(20)  PRIMARY KEY,
    name           VARCHAR(50)  NOT NULL,
    max_jobs       INTEGER      NOT NULL,
    max_candidates INTEGER      NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
 
-- 2. Seed the 3 plans
INSERT INTO plans (id, name, max_jobs, max_candidates) VALUES
    ('plan-free',   'Free',   7,   10),
    ('plan-silver', 'Silver', 20,  50),
    ('plan-gold',   'Gold',   100, 500)
ON CONFLICT (id) DO NOTHING;
 
-- 3. Add plan_id to login table, defaulting every existing user to Free
ALTER TABLE login
    ADD COLUMN IF NOT EXISTS plan_id VARCHAR(20)
        NOT NULL DEFAULT 'plan-free'
        REFERENCES plans(id);
 
-- 4. Index for fast plan lookups
CREATE INDEX IF NOT EXISTS idx_logins_plan_id ON login(plan_id);


-- 1. Add max_tokens column to plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_tokens INTEGER NOT NULL DEFAULT 100;
 
-- 2. Update existing plans with token values
UPDATE plans SET max_tokens = 100  WHERE id = 'plan-free';
UPDATE plans SET max_tokens = 500  WHERE id = 'plan-silver';
UPDATE plans SET max_tokens = 1000 WHERE id = 'plan-gold';
 
-- 3. Add bronze plan
INSERT INTO plans (id, name, max_jobs, max_candidates, max_tokens)
VALUES ('plan-bronze', 'Bronze', 10, 20, 250)
ON CONFLICT (id) DO NOTHING;
 
-- 4. Add tokens_remaining and renew_date to login table
ALTER TABLE login
    ADD COLUMN IF NOT EXISTS tokens_remaining INTEGER NOT NULL DEFAULT 100;
ALTER TABLE login
    ADD COLUMN IF NOT EXISTS renew_date DATE NOT NULL DEFAULT (now()::date + INTERVAL '30 days');
 
-- 5. Populate tokens_remaining based on each user's current plan
UPDATE login l
SET tokens_remaining = p.max_tokens
FROM plans p
WHERE l.plan_id = p.id;


ALTER TABLE login ADD COLUMN IF NOT EXISTS phone_number TEXT;
 
-- 2. Add 'registered' and 'admin' as special plan_id values
--    These are not real plans — they are status markers for unboarded/admin users.
--    We insert them as plan rows so the FK constraint is satisfied.
INSERT INTO plans (id, name, max_jobs, max_candidates, max_tokens)
VALUES
    ('registered', 'Registered', 0, 0, 0),
    ('admin',      'Admin',      0, 0, 0)
ON CONFLICT (id) DO NOTHING;

