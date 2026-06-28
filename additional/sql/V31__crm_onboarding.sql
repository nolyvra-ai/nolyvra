-- V31__crm_onboarding.sql
-- CRMx Sprint 2: Configurable Onboarding Workflow + Employee Documents
-- ADDITIVE ONLY — no existing tables or columns are altered.
-- Apply manually; do not run via Flyway auto-migration.
-- Depends on: V30__crm_foundation.sql (employees, departments, login.crm_enabled)
--
-- NOTE: the 7-stage default seed template is seeded by the application service layer
-- (OnboardingTemplateService.seedDefaultTemplate) on first access per tenant —
-- not here, because tenants are created dynamically after this migration runs.

-- ─── 1. Onboarding Template (tenant-defined, reusable config) ─────────────
CREATE TABLE IF NOT EXISTS onboarding_template (
    id              TEXT          NOT NULL PRIMARY KEY,
    login_id        TEXT          NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    name            VARCHAR(255)  NOT NULL,
    employment_type TEXT,                               -- PERMANENT | CONTRACT | PLACED | NULL = all types
    is_default      BOOLEAN       NOT NULL DEFAULT false,
    is_active       BOOLEAN       NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_ob_template_emp_type
        CHECK (employment_type IS NULL
               OR employment_type IN ('PERMANENT', 'CONTRACT', 'PLACED'))
);

CREATE INDEX IF NOT EXISTS idx_ob_template_login_id ON onboarding_template (login_id);

-- ─── 2. Template Groups (ordered collapsible stages within a template) ────
CREATE TABLE IF NOT EXISTS onboarding_template_group (
    id           TEXT          NOT NULL PRIMARY KEY,
    template_id  TEXT          NOT NULL REFERENCES onboarding_template(id) ON DELETE CASCADE,
    name         VARCHAR(255)  NOT NULL,
    sequence     INTEGER       NOT NULL,               -- ordering within template; app manages uniqueness
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ob_tgroup_template_id ON onboarding_template_group (template_id);

-- ─── 3. Template Tasks (ordered items within a group) ─────────────────────
CREATE TABLE IF NOT EXISTS onboarding_template_task (
    id              TEXT          NOT NULL PRIMARY KEY,
    group_id        TEXT          NOT NULL REFERENCES onboarding_template_group(id) ON DELETE CASCADE,
    name            VARCHAR(255)  NOT NULL,
    sequence        INTEGER       NOT NULL,
    owner_role      TEXT,                              -- HR | HIRING_MANAGER | IT | OTHER | NULL
    due_offset_days INTEGER,                          -- days from employee.start_date; negative = before start
    is_required     BOOLEAN       NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_ob_ttask_owner_role
        CHECK (owner_role IS NULL
               OR owner_role IN ('HR', 'HIRING_MANAGER', 'IT', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_ob_ttask_group_id ON onboarding_template_task (group_id);

-- ─── 4. Onboarding Instance (one live onboarding run per employee) ─────────
CREATE TABLE IF NOT EXISTS onboarding_instance (
    id            TEXT        NOT NULL PRIMARY KEY,
    login_id      TEXT        NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    employee_id   TEXT        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    template_id   TEXT                 REFERENCES onboarding_template(id) ON DELETE SET NULL,
    status        TEXT        NOT NULL DEFAULT 'IN_PROGRESS',
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ob_instance_status
        CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

-- Enforce one non-cancelled instance per employee per tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_ob_instance_employee
    ON onboarding_instance (login_id, employee_id)
    WHERE status NOT IN ('CANCELLED');

CREATE INDEX IF NOT EXISTS idx_ob_instance_login_id    ON onboarding_instance (login_id);
CREATE INDEX IF NOT EXISTS idx_ob_instance_employee_id ON onboarding_instance (employee_id);
CREATE INDEX IF NOT EXISTS idx_ob_instance_status      ON onboarding_instance (status);

-- ─── 5. Onboarding Tasks (snapshotted live tasks for one instance) ─────────
-- group_name and group_sequence are intentionally denormalised from the template.
-- This means editing a template after instantiation never disturbs an in-flight
-- onboarding. Per-group progress is derived via GROUP BY (group_sequence, group_name).
CREATE TABLE IF NOT EXISTS onboarding_task (
    id                TEXT          NOT NULL PRIMARY KEY,
    instance_id       TEXT          NOT NULL REFERENCES onboarding_instance(id) ON DELETE CASCADE,
    group_name        VARCHAR(255)  NOT NULL,          -- snapshotted from onboarding_template_group.name
    group_sequence    INTEGER       NOT NULL,          -- snapshotted — used for GROUP BY ordering
    name              VARCHAR(255)  NOT NULL,          -- snapshotted task name
    sequence          INTEGER       NOT NULL,          -- ordering within group
    owner_role        TEXT,                            -- snapshotted
    assignee_user_id  TEXT                 REFERENCES login(id) ON DELETE SET NULL,
    due_date          DATE,                           -- computed: employee.start_date + due_offset_days
    is_required       BOOLEAN       NOT NULL DEFAULT true,
    status            TEXT          NOT NULL DEFAULT 'PENDING',
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_ob_task_status
        CHECK (status IN ('PENDING', 'COMPLETE', 'SKIPPED')),
    CONSTRAINT chk_ob_task_owner_role
        CHECK (owner_role IS NULL
               OR owner_role IN ('HR', 'HIRING_MANAGER', 'IT', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_ob_task_instance_id      ON onboarding_task (instance_id);
CREATE INDEX IF NOT EXISTS idx_ob_task_assignee         ON onboarding_task (assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_ob_task_due_date         ON onboarding_task (due_date);
CREATE INDEX IF NOT EXISTS idx_ob_task_status           ON onboarding_task (status);

-- ─── 6. Employee Documents (standalone — outlives onboarding) ─────────────
-- Intentionally NOT a child of onboarding_instance: documents (visa, RTW, certs)
-- belong to the employee long-term and will need expiry watching in a future sprint.
-- expiry_date is stored now (forward-compat) but NO alerting is built in this sprint.
CREATE TABLE IF NOT EXISTS employee_document (
    id           TEXT           NOT NULL PRIMARY KEY,
    login_id     TEXT           NOT NULL REFERENCES login(id) ON DELETE CASCADE,
    employee_id  TEXT           NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    doc_type     TEXT,                                -- CONTRACT | ID | RIGHT_TO_WORK | CERTIFICATION | OTHER
    file_ref     VARCHAR(1024)  NOT NULL,             -- storage reference (same pattern as candidate CVs)
    file_name    VARCHAR(512)   NOT NULL,
    expiry_date  DATE,                               -- nullable; stored for future sprint, not watched yet
    is_active    BOOLEAN        NOT NULL DEFAULT true,
    uploaded_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT chk_emp_doc_type
        CHECK (doc_type IS NULL
               OR doc_type IN ('CONTRACT', 'ID', 'RIGHT_TO_WORK', 'CERTIFICATION', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_emp_doc_login_id    ON employee_document (login_id);
CREATE INDEX IF NOT EXISTS idx_emp_doc_employee_id ON employee_document (employee_id);

-- ─── Rollback script (run manually if needed) ──────────────────────────────
-- DROP TABLE IF EXISTS employee_document;
-- DROP TABLE IF EXISTS onboarding_task;
-- DROP TABLE IF EXISTS onboarding_instance;
-- DROP TABLE IF EXISTS onboarding_template_task;
-- DROP TABLE IF EXISTS onboarding_template_group;
-- DROP TABLE IF EXISTS onboarding_template;
