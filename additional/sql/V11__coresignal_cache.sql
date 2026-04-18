create table if not exists coresignal_cache (
    id bigserial primary key,
    coresignal_id bigint unique not null,
    full_name text,
    job_title text,
    current_company text,
    location_city text,
    location_country text,
    linkedin_url text,
    skills jsonb,
    years_experience int,
    management_level text,
    description text,
    raw_json jsonb,
    cached_at timestamptz default now(),
    last_searched_at timestamptz default now()
);

create index if not exists idx_cs_cache_job_title on coresignal_cache (lower(job_title));
create index if not exists idx_cs_cache_location on coresignal_cache (lower(location_country), lower(location_city));
create index if not exists idx_cs_cache_skills on coresignal_cache using gin(skills);
create index if not exists idx_cs_cache_cached_at on coresignal_cache (cached_at);
