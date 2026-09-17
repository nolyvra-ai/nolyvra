-- V74__sub_users.sql
-- Sub-users: a Silver/Gold plan owner can invite additional logins that
-- operate within the owner's tenant (same jobs/candidates/everything) but
-- cannot change plans or invite further sub-users. Apply manually; do not
-- run via Flyway auto-migration.

ALTER TABLE login ADD COLUMN IF NOT EXISTS is_subuser boolean NOT NULL DEFAULT false;
ALTER TABLE login ADD COLUMN IF NOT EXISTS parent_login_id text REFERENCES login(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_login_parent_login_id
    ON login(parent_login_id) WHERE parent_login_id IS NOT NULL;

-- Tracks which real login actually authenticated a session, separate from
-- the tenant it operates under — a sub-user's session.login_id is set to the
-- PARENT (so all existing loginId-scoped queries naturally see the owner's
-- data), while actor_login_id records the sub-user's own identity so
-- privileged actions (change plan, invite sub-users) can be blocked
-- server-side regardless of which loginId was sent in the request.
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS actor_login_id text REFERENCES login(id) ON DELETE CASCADE;

ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_subusers integer NOT NULL DEFAULT 0;
UPDATE plans SET max_subusers = 4  WHERE id = 'plan-silver';
UPDATE plans SET max_subusers = 14 WHERE id = 'plan-gold';
