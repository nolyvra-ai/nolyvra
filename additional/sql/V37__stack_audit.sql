-- Stack Audit lead-capture submissions with computed cost-comparison report

CREATE TABLE IF NOT EXISTS stack_audit_submission (
    id               BIGSERIAL    PRIMARY KEY,
    full_name        TEXT         NOT NULL,
    company_name     TEXT         NOT NULL,
    email            TEXT         NOT NULL,
    phone            TEXT         NOT NULL,
    candidate_tools  JSONB        NOT NULL DEFAULT '[]',
    ats_tool         TEXT         NOT NULL,
    ats_expense      INTEGER      NOT NULL DEFAULT 0,
    ats_features     JSONB        NOT NULL DEFAULT '[]',
    crm_tool         TEXT         NOT NULL,
    crm_expense      INTEGER      NOT NULL DEFAULT 0,
    crm_features     JSONB        NOT NULL DEFAULT '[]',
    ai_tools         JSONB        NOT NULL DEFAULT '[]',
    uses_ai_agent    BOOLEAN      NOT NULL DEFAULT false,
    ai_agent_expense INTEGER,
    consent          BOOLEAN      NOT NULL DEFAULT false,
    computed_report  JSONB,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stack_audit_email      ON stack_audit_submission(email);
CREATE INDEX IF NOT EXISTS idx_stack_audit_created_at ON stack_audit_submission(created_at DESC);
