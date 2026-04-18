create table if not exists oauth_tokens (
    id            bigserial    primary key,
    login_id      text         not null,
    provider      text         not null,
    access_token  text         not null,
    refresh_token text,
    expires_at    timestamptz,
    email         text,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz  not null default now(),
    unique (login_id, provider)
);
