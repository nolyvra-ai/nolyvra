-- Local development only.
-- Recreates the default local account and a reusable test job.
-- Login: local@nolyvra.test
-- Password: Welcome1

\set ON_ERROR_STOP on

begin;

insert into plans (id, name, max_jobs, max_candidates, max_tokens)
values ('plan-free', 'Free', 7, 10, 100)
on conflict (id) do nothing;

insert into login (
    id,
    name,
    company,
    email,
    password_hash,
    plan_id,
    tokens_remaining,
    renew_date,
    additional_tokens,
    additional_jobs,
    additional_candidates,
    created_at,
    updated_at
) values (
    'local@nolyvra.test',
    'Local Demo',
    'Nolyvra Local',
    'local@nolyvra.test',
    '7e19e31ae82d749034fc921f777f717ba5b57c6add9add889eb536ac6effcde0',
    'plan-free',
    100,
    current_date + interval '30 days',
    0,
    0,
    0,
    now(),
    now()
)
on conflict (id) do update
set name = excluded.name,
    company = excluded.company,
    email = excluded.email,
    password_hash = excluded.password_hash,
    plan_id = excluded.plan_id,
    tokens_remaining = excluded.tokens_remaining,
    renew_date = excluded.renew_date,
    additional_tokens = excluded.additional_tokens,
    additional_jobs = excluded.additional_jobs,
    additional_candidates = excluded.additional_candidates,
    updated_at = now();

insert into jobs (
    id,
    title,
    company,
    job_type,
    jd_text,
    location,
    login_id,
    status,
    brief_text,
    is_active,
    created_at,
    updated_at
) values (
    'job-local-senior-backend',
    'Senior Backend Engineer',
    'Nolyvra Local Test',
    'Full-time',
    'We are looking for a Senior Backend Engineer with strong Java, Spring Boot, PostgreSQL, REST API design, cloud deployment, and production debugging experience. The role involves building reliable hiring workflow services, integrating AI-assisted analysis, and collaborating closely with product teams.',
    'Melbourne / Remote',
    'local@nolyvra.test',
    'Active',
    'Senior backend role focused on Java, Spring Boot, PostgreSQL, APIs, cloud systems, and reliable production delivery.',
    true,
    now(),
    now()
)
on conflict (id) do update
set title = excluded.title,
    company = excluded.company,
    job_type = excluded.job_type,
    jd_text = excluded.jd_text,
    location = excluded.location,
    login_id = excluded.login_id,
    status = excluded.status,
    brief_text = excluded.brief_text,
    is_active = excluded.is_active,
    updated_at = now();

commit;
