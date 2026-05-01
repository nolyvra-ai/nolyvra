-- V13: Background analysis queue
-- Stores candidate analysis jobs so bulk analysis can be processed gradually.

create table if not exists analysis_jobs (
    id           bigserial primary key,
    batch_id     text        not null,
    candidate_id text        not null references candidates(id) on delete cascade,
    login_id     text        not null references login(id) on delete cascade,
    status       text        not null default 'queued',
    attempts     integer     not null default 0,
    error_message text,
    next_run_at  timestamptz not null default now(),
    created_at   timestamptz not null default now(),
    started_at   timestamptz,
    finished_at  timestamptz,
    updated_at   timestamptz not null default now()
);

create index if not exists idx_analysis_jobs_batch_id
    on analysis_jobs(batch_id);

create index if not exists idx_analysis_jobs_worker
    on analysis_jobs(status, next_run_at, created_at);

create index if not exists idx_analysis_jobs_candidate_id
    on analysis_jobs(candidate_id);

create unique index if not exists idx_analysis_jobs_candidate_active
    on analysis_jobs(candidate_id)
    where status in ('queued', 'running', 'succeeded');

