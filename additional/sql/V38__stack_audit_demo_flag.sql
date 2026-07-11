-- V38: add demo_requested flag to stack audit submissions
ALTER TABLE stack_audit_submission
    ADD COLUMN demo_requested BOOLEAN NOT NULL DEFAULT FALSE;
