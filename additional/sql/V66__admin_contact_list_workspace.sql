-- V66__admin_contact_list_workspace.sql
-- Persists the admin Contact List Builder workspace per authenticated tenant.
-- Additive only.

CREATE TABLE IF NOT EXISTS admin_contact_list_workspaces (
    login_id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    header_row INTEGER,
    imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT fk_admin_contact_list_workspace_login
        FOREIGN KEY (login_id) REFERENCES login(id) ON DELETE CASCADE
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_admin_contact_list_workspace_login'
    ) THEN
        ALTER TABLE admin_contact_list_workspaces
            ADD CONSTRAINT fk_admin_contact_list_workspace_login
            FOREIGN KEY (login_id) REFERENCES login(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS admin_contact_list_contacts (
    id UUID PRIMARY KEY,
    login_id TEXT NOT NULL
        REFERENCES admin_contact_list_workspaces(login_id) ON DELETE CASCADE,
    row_order INTEGER NOT NULL,
    company TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    segment TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT '',
    date_added TEXT NOT NULL DEFAULT '',
    last_contact TEXT NOT NULL DEFAULT '',
    next_action_date TEXT NOT NULL DEFAULT '',
    next_step TEXT NOT NULL DEFAULT '',
    package_name TEXT NOT NULL DEFAULT '',
    potential_mrr TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    consent_status TEXT NOT NULL,
    has_valid_email BOOLEAN NOT NULL DEFAULT false,
    is_duplicate BOOLEAN NOT NULL DEFAULT false,
    edited BOOLEAN NOT NULL DEFAULT false,
    issues_json TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (login_id, row_order)
);

CREATE INDEX IF NOT EXISTS idx_admin_contact_list_contacts_login
    ON admin_contact_list_contacts(login_id, row_order);
