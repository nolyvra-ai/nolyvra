-- ═══════════════════════════════════════════════════════════════════════════
-- nolyvra — Render PostgreSQL Initialization Script
-- Run this once on a fresh Render PostgreSQL database
-- ═══════════════════════════════════════════════════════════════════════════

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

-- ─── 1. PLANS (must be first — login FK references this) ─────────────────────

CREATE TABLE IF NOT EXISTS plans (
    id           VARCHAR(20)  PRIMARY KEY,
    name         VARCHAR(50)  NOT NULL,
    max_jobs     INTEGER      NOT NULL,
    max_candidates INTEGER    NOT NULL,
    max_tokens   INTEGER      NOT NULL DEFAULT 100,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Seed all plans
INSERT INTO plans (id, name, max_jobs, max_candidates, max_tokens) VALUES
    ('plan-free',    'Free',       7,    10,   100),
    ('plan-bronze',  'Bronze',    10,    20,   250),
    ('plan-silver',  'Silver',    20,    50,   500),
    ('plan-gold',    'Gold',     100,   500,  1000),
    ('registered',   'Registered', 0,     0,     0),
    ('admin',        'Admin',      0,     0,     0)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. LOGIN ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS login (
    id                 TEXT         PRIMARY KEY,
    name               TEXT         NOT NULL,
    company            TEXT,
    email              TEXT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    password_hash      TEXT,
    plan_id            VARCHAR(20)  NOT NULL DEFAULT 'plan-free'
                           REFERENCES plans(id),
    tokens_remaining   INTEGER      NOT NULL DEFAULT 100,
    renew_date         DATE         NOT NULL DEFAULT (now()::date + INTERVAL '30 days'),
    phone_number       TEXT,
    stripe_customer_id TEXT,
    CONSTRAINT login_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_login_plan_id ON login(plan_id);
CREATE INDEX IF NOT EXISTS idx_login_email   ON login(email);

-- ─── 3. JOBS ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jobs (
    id         TEXT        PRIMARY KEY,
    title      TEXT        NOT NULL,
    company    TEXT,
    job_type   TEXT,
    jd_text    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    location   TEXT,
    login_id   TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    status     TEXT        NOT NULL DEFAULT 'Active',
    brief_text TEXT,
    is_active  BOOLEAN     NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_jobs_login_id  ON jobs(login_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);

-- ─── 4. CANDIDATES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS candidates (
    id              TEXT        PRIMARY KEY,
    job_id          TEXT        REFERENCES jobs(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    linkedin_url    TEXT,
    cv_text         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    email           TEXT,
    login_id        TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    stage           TEXT        NOT NULL DEFAULT 'Screening',
    recruiter_notes TEXT,
    is_active       BOOLEAN     NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_candidates_login_id  ON candidates(login_id);
CREATE INDEX IF NOT EXISTS idx_candidates_job_id    ON candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_is_active ON candidates(is_active);

-- ─── 5. ANALYSES ──────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS analyses_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS analyses (
    id                     BIGINT      PRIMARY KEY DEFAULT nextval('analyses_id_seq'),
    candidate_id           TEXT        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id                 TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    analyzed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    consistency_score      INTEGER,
    capability_score       INTEGER,
    risk_level             TEXT,
    timeline_match_percent INTEGER,
    analysis_json          JSONB       NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    candidate_name         TEXT,
    login_id               TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    ai_summary_json        JSONB,
    fraud_signals_json     JSONB,
    placement_prob_json    JSONB
);

CREATE INDEX IF NOT EXISTS idx_analyses_candidate_id ON analyses(candidate_id);
CREATE INDEX IF NOT EXISTS idx_analyses_job_id       ON analyses(job_id);
CREATE INDEX IF NOT EXISTS idx_analyses_login_id     ON analyses(login_id);
CREATE INDEX IF NOT EXISTS idx_analyses_analyzed_at  ON analyses(analyzed_at DESC);

-- ─── 6. ACTIVITY TIMELINE ─────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS activity_timeline_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS activity_timeline (
    id           BIGINT      PRIMARY KEY DEFAULT nextval('activity_timeline_id_seq'),
    candidate_id TEXT        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    login_id     TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    event_type   TEXT        NOT NULL,
    event_data   JSONB,
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_candidate_id ON activity_timeline(candidate_id);
CREATE INDEX IF NOT EXISTS idx_activity_login_id     ON activity_timeline(login_id);
CREATE INDEX IF NOT EXISTS idx_activity_event_type   ON activity_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_created_at   ON activity_timeline(created_at DESC);

-- ─── 7. INTERVIEWS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS interviews (
    id               TEXT        PRIMARY KEY,
    candidate_id     TEXT        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id           TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    login_id         TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    interviewer      TEXT,
    interview_type   TEXT,
    scheduled_at     TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER     DEFAULT 60,
    location         TEXT,
    meeting_link     TEXT,
    notes            TEXT,
    status           TEXT        NOT NULL DEFAULT 'Scheduled',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id  ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_login_id      ON interviews(login_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at  ON interviews(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_status        ON interviews(status);

-- ─── 8. EMAIL HISTORY ─────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS email_history_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS email_history (
    id            BIGINT      PRIMARY KEY DEFAULT nextval('email_history_id_seq'),
    candidate_id  TEXT        REFERENCES candidates(id) ON DELETE SET NULL,
    login_id      TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    to_address    TEXT        NOT NULL,
    subject       TEXT        NOT NULL,
    body          TEXT        NOT NULL,
    template_type TEXT,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    status        TEXT        NOT NULL DEFAULT 'Sent'
);

CREATE INDEX IF NOT EXISTS idx_email_history_login_id     ON email_history(login_id);
CREATE INDEX IF NOT EXISTS idx_email_history_candidate_id ON email_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_history_sent_at      ON email_history(sent_at DESC);

-- ─── 9. EMAIL TEMPLATES ───────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS email_templates_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS email_templates (
    id            BIGINT      PRIMARY KEY DEFAULT nextval('email_templates_id_seq'),
    login_id      TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    template_type TEXT        NOT NULL,
    name          TEXT        NOT NULL,
    subject       TEXT        NOT NULL,
    body          TEXT        NOT NULL,
    is_default    BOOLEAN     DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_login_id ON email_templates(login_id);

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key   TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL DEFAULT '',
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ─── 10. REMINDERS ────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS reminders_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS reminders (
    id             BIGINT      PRIMARY KEY DEFAULT nextval('reminders_id_seq'),
    login_id       TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    candidate_id   TEXT        REFERENCES candidates(id) ON DELETE SET NULL,
    title          TEXT        NOT NULL,
    description    TEXT,
    reminder_type  TEXT        NOT NULL DEFAULT 'MANUAL',
    priority       TEXT        NOT NULL DEFAULT 'Normal',
    due_at         TIMESTAMPTZ NOT NULL,
    is_completed   BOOLEAN     NOT NULL DEFAULT false,
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_login_id      ON reminders(login_id);
CREATE INDEX IF NOT EXISTS idx_reminders_candidate_id  ON reminders(candidate_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_at        ON reminders(due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_is_completed  ON reminders(is_completed);

-- ─── 11. COWORKER MESSAGES ────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS coworker_messages_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS coworker_messages (
    id         BIGINT      PRIMARY KEY DEFAULT nextval('coworker_messages_id_seq'),
    login_id   TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    role       TEXT        NOT NULL,
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coworker_messages_login
    ON coworker_messages(login_id, created_at DESC);

-- ─── 12. COWORKER TASKS ───────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS coworker_tasks_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS coworker_tasks (
    id           BIGINT      PRIMARY KEY DEFAULT nextval('coworker_tasks_id_seq'),
    login_id     TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    task_type    TEXT        NOT NULL,
    description  TEXT,
    status       TEXT        NOT NULL DEFAULT 'pending',
    progress     INTEGER     NOT NULL DEFAULT 0,
    result_json  JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_coworker_tasks_login
    ON coworker_tasks(login_id);
CREATE INDEX IF NOT EXISTS idx_coworker_tasks_status
    ON coworker_tasks(login_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- Done — all tables, indexes and seed data created
-- ═══════════════════════════════════════════════════════════════════════════

-- Additional Changes:

alter table login
    add column if not exists additional_tokens     integer not null default 0,
    add column if not exists additional_jobs       integer not null default 0,
    add column if not exists additional_candidates integer not null default 0;
