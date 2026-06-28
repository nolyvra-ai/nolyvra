-- CRMx Leave Management: leave types, per-employee balances, leave requests
-- Single-approver workflow: PENDING → APPROVED / REJECTED / CANCELLED

-- ─── Leave types (tenant-defined) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_type (
    id                   VARCHAR(50)   PRIMARY KEY,
    login_id             TEXT          NOT NULL,
    name                 VARCHAR(100)  NOT NULL,
    default_days_per_year INTEGER       NOT NULL DEFAULT 0,
    is_paid              BOOLEAN       NOT NULL DEFAULT true,
    color                VARCHAR(20)   NOT NULL DEFAULT '#1D72E8',
    is_active            BOOLEAN       NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_type_login
    ON leave_type (login_id) WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_type_name
    ON leave_type (login_id, name) WHERE is_active = true;

-- ─── Per-employee, per-year leave balance ─────────────────────────────────────
-- allocated_days may override the leave_type default for a specific employee
-- used_days is computed live from approved leave_requests (not stored)
CREATE TABLE IF NOT EXISTS employee_leave_balance (
    id              VARCHAR(50)    PRIMARY KEY,
    login_id        TEXT           NOT NULL,
    employee_id     VARCHAR(50)    NOT NULL REFERENCES employees(id),
    leave_type_id   VARCHAR(50)    NOT NULL REFERENCES leave_type(id),
    year            INTEGER        NOT NULL,
    allocated_days  NUMERIC(5,1)   NOT NULL DEFAULT 0,
    is_active       BOOLEAN        NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT uq_elb_employee_type_year UNIQUE (login_id, employee_id, leave_type_id, year)
);

CREATE INDEX IF NOT EXISTS idx_elb_employee_year
    ON employee_leave_balance (employee_id, year) WHERE is_active = true;

-- ─── Leave requests ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_request (
    id                VARCHAR(50)   PRIMARY KEY,
    login_id          TEXT          NOT NULL,
    employee_id       VARCHAR(50)   NOT NULL REFERENCES employees(id),
    leave_type_id     VARCHAR(50)   NOT NULL REFERENCES leave_type(id),
    start_date        DATE          NOT NULL,
    end_date          DATE          NOT NULL,
    days_requested    NUMERIC(5,1)  NOT NULL,
    reason            TEXT,
    status            TEXT          NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    approver_comment  TEXT,
    actioned_at       TIMESTAMPTZ,
    is_active         BOOLEAN       NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_request_login_emp
    ON leave_request (login_id, employee_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_leave_request_status
    ON leave_request (login_id, status) WHERE is_active = true;
