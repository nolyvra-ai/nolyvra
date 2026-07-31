create table if not exists system_email_templates (
    template_key varchar(80) primary key,
    subject text not null,
    html_body text not null,
    text_body text not null,
    enabled boolean not null default true,
    version bigint not null default 1,
    updated_at timestamp with time zone not null default now(),
    updated_by text not null
);
