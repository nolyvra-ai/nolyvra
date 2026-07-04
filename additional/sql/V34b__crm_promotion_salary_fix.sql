-- CRMx: Promotion Workflow + Salary Review -- corrected column types (TEXT to match employees.id)
-- Safe to run even if V34 partially applied: all statements use IF NOT EXISTS / COALESCE guards.

-- New columns on employees (idempotent)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary                NUMERIC(12,2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_effective_from DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS promotion_effective   DATE;

-- Promotion request
-- Checklist: recommendation_reviewed, performance_validated, leadership_approved, compensation_reviewed
-- On APPROVE: copies proposed_role -> job_title, sets promotion_effective on employees
CREATE TABLE IF NOT EXISTS promotion_request (
    id                           TEXT        PRIMARY KEY,
    login_id                     TEXT        NOT NULL,
    employee_id                  TEXT        NOT NULL REFERENCES employees(id),
    previous_role                TEXT,
    proposed_role                TEXT        NOT NULL,
    promotion_effective          DATE,
    notes                        TEXT,
    status                       TEXT        NOT NULL DEFAULT 'IN_PROGRESS'
                                     CHECK (status IN ('IN_PROGRESS','APPROVED','REJECTED','CANCELLED')),
    step_recommendation_reviewed BOOLEAN     NOT NULL DEFAULT false,
    step_performance_validated   BOOLEAN     NOT NULL DEFAULT false,
    step_leadership_approved     BOOLEAN     NOT NULL DEFAULT false,
    step_compensation_reviewed   BOOLEAN     NOT NULL DEFAULT false,
    is_active                    BOOLEAN     NOT NULL DEFAULT true,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_login_emp ON promotion_request (login_id, employee_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_status    ON promotion_request (login_id, status)      WHERE is_active = true;

-- Salary / compensation review
-- Checklist: salary_reviewed, manager_proposed, finance_approved, hr_approved
-- On APPROVE: copies proposed_salary -> salary, sets salary_effective_from on employees
CREATE TABLE IF NOT EXISTS salary_review (
    id                    TEXT        PRIMARY KEY,
    login_id              TEXT        NOT NULL,
    employee_id           TEXT        NOT NULL REFERENCES employees(id),
    current_salary        NUMERIC(12,2),
    proposed_salary       NUMERIC(12,2) NOT NULL,
    effective_from        DATE,
    notes                 TEXT,
    status                TEXT        NOT NULL DEFAULT 'IN_PROGRESS'
                              CHECK (status IN ('IN_PROGRESS','APPROVED','REJECTED','CANCELLED')),
    step_salary_reviewed  BOOLEAN     NOT NULL DEFAULT false,
    step_manager_proposed BOOLEAN     NOT NULL DEFAULT false,
    step_finance_approved BOOLEAN     NOT NULL DEFAULT false,
    step_hr_approved      BOOLEAN     NOT NULL DEFAULT false,
    is_active             BOOLEAN     NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_srev_login_emp ON salary_review (login_id, employee_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_srev_status    ON salary_review (login_id, status)      WHERE is_active = true;
