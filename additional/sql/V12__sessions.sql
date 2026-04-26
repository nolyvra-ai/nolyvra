-- V12: User session tracking
-- Adds user_sessions table to support:
--   - 4-hour session expiry per login
--   - single active session per login (prevents concurrent logins with same credentials)
--
-- Apply manually. Rollback script at the bottom.

create table if not exists user_sessions (
    token      uuid        not null default gen_random_uuid(),
    login_id   text        not null references login(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    is_active  boolean     not null default true,
    constraint pk_user_sessions primary key (token)
);

-- Fast lookup when invalidating existing sessions for a user on new login
create index if not exists idx_user_sessions_login_id on user_sessions(login_id);

-- Fast lookup for scheduled cleanup of expired rows
create index if not exists idx_user_sessions_expires_at on user_sessions(expires_at);

-- ─── ROLLBACK ────────────────────────────────────────────────────────────────
-- drop index if exists idx_user_sessions_expires_at;
-- drop index if exists idx_user_sessions_login_id;
-- drop table if exists user_sessions;
