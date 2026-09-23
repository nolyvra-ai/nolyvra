-- Seltz.ai candidate search cache. Mirrors coresignal_cache's shape/TTL
-- convention, but keyed by profile URL (Seltz has no separate numeric
-- candidate id) since each search result already carries the full profile
-- content in one call — no separate "collect" step needed.

create table if not exists seltz_cache (
    id bigserial primary key,
    seltz_url text unique not null,
    full_name text,
    job_title text,
    current_company text,
    location text,
    skills jsonb,
    content text,
    cached_at timestamptz default now(),
    last_searched_at timestamptz default now()
);

create index if not exists idx_seltz_cache_job_title on seltz_cache (lower(job_title));
create index if not exists idx_seltz_cache_location on seltz_cache (lower(location));
create index if not exists idx_seltz_cache_skills on seltz_cache using gin(skills);
create index if not exists idx_seltz_cache_cached_at on seltz_cache (cached_at);
