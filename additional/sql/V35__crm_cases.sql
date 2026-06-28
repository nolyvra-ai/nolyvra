-- ─── Expense Reimbursement ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expense_submission (
    id                  TEXT        PRIMARY KEY,
    login_id            TEXT        NOT NULL,
    employee_id         TEXT        NOT NULL REFERENCES employees(id),
    title               TEXT        NOT NULL,
    amount              NUMERIC(12,2),
    category            TEXT,
    expense_date        DATE,
    receipt_name        TEXT,
    receipt_data        BYTEA,
    notes               TEXT,
    status              TEXT        NOT NULL DEFAULT 'IN_PROGRESS'
                            CHECK (status IN ('IN_PROGRESS','APPROVED','REJECTED','CANCELLED')),
    step_finance_reviewed   BOOLEAN NOT NULL DEFAULT false,
    step_approved           BOOLEAN NOT NULL DEFAULT false,
    step_payment_made       BOOLEAN NOT NULL DEFAULT false,
    step_closed             BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_submission_login_id    ON expense_submission(login_id);
CREATE INDEX IF NOT EXISTS idx_expense_submission_employee_id ON expense_submission(employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_submission_status      ON expense_submission(login_id, status) WHERE is_active = true;

-- ─── Employee Grievance ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grievance (
    id                  TEXT        PRIMARY KEY,
    login_id            TEXT        NOT NULL,
    employee_id         TEXT        NOT NULL REFERENCES employees(id),
    title               TEXT        NOT NULL,
    description         TEXT,
    complaint_name      TEXT,
    complaint_data      BYTEA,
    resolution_notes    TEXT,
    status              TEXT        NOT NULL DEFAULT 'IN_PROGRESS'
                            CHECK (status IN ('IN_PROGRESS','RESOLVED','REJECTED','CANCELLED')),
    step_investigated       BOOLEAN NOT NULL DEFAULT false,
    step_hr_reviewed        BOOLEAN NOT NULL DEFAULT false,
    step_resolved           BOOLEAN NOT NULL DEFAULT false,
    step_closed             BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grievance_login_id    ON grievance(login_id);
CREATE INDEX IF NOT EXISTS idx_grievance_employee_id ON grievance(employee_id);
CREATE INDEX IF NOT EXISTS idx_grievance_status      ON grievance(login_id, status) WHERE is_active = true;

-- ─── Disciplinary Action ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disciplinary_action (
    id                      TEXT        PRIMARY KEY,
    login_id                TEXT        NOT NULL,
    employee_id             TEXT        NOT NULL REFERENCES employees(id),
    title                   TEXT        NOT NULL,
    incident_description    TEXT,
    incident_report_name    TEXT,
    incident_report_data    BYTEA,
    hr_decision_name        TEXT,
    hr_decision_data        BYTEA,
    notes                   TEXT,
    status                  TEXT        NOT NULL DEFAULT 'IN_PROGRESS'
                                CHECK (status IN ('IN_PROGRESS','CLOSED','CANCELLED')),
    step_investigated       BOOLEAN NOT NULL DEFAULT false,
    step_manager_reviewed   BOOLEAN NOT NULL DEFAULT false,
    step_hr_decided         BOOLEAN NOT NULL DEFAULT false,
    is_active               BOOLEAN     NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disciplinary_login_id    ON disciplinary_action(login_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_employee_id ON disciplinary_action(employee_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_status      ON disciplinary_action(login_id, status) WHERE is_active = true;

-- ─── Corrective Action Plan (customisable per disciplinary action) ────────────

CREATE TABLE IF NOT EXISTS disciplinary_corrective_action (
    id                      TEXT        PRIMARY KEY,
    login_id                TEXT        NOT NULL,
    disciplinary_action_id  TEXT        NOT NULL REFERENCES disciplinary_action(id) ON DELETE CASCADE,
    item_text               TEXT        NOT NULL,
    is_done                 BOOLEAN     NOT NULL DEFAULT false,
    sort_order              INT         NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corrective_action_parent ON disciplinary_corrective_action(disciplinary_action_id);
