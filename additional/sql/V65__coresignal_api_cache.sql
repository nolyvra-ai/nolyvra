-- Dedicated cache for the real CoreSignal API integration, separate from
-- coresignal_cache (which now belongs to Bright Data — see
-- V39__coresignal_cache_brightdata.sql, coresignal_id there was widened to
-- text for Bright Data's string slugs). CoreSignal's own IDs are numeric,
-- so this table keeps the original bigint shape.

create table if not exists coresignal_api_cache (
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

create index if not exists idx_cs_api_cache_job_title on coresignal_api_cache (lower(job_title));
create index if not exists idx_cs_api_cache_location on coresignal_api_cache (lower(location_country), lower(location_city));
create index if not exists idx_cs_api_cache_skills on coresignal_api_cache using gin(skills);
create index if not exists idx_cs_api_cache_cached_at on coresignal_api_cache (cached_at);
