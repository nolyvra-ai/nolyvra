-- Move the four templates previously stored in app_settings into the managed
-- system template table. Existing managed templates always win so this
-- migration is safe to run after administrators have started using the new UI.

create table if not exists app_settings (
    setting_key text primary key,
    setting_value text not null default '',
    updated_at timestamp with time zone not null default now()
);

with legacy as (
    select
        max(setting_value) filter (
            where setting_key = 'onboarding_confirmation_subject'
        ) as onboarding_confirmation_subject,
        max(setting_value) filter (
            where setting_key = 'onboarding_confirmation_html'
        ) as onboarding_confirmation_html,
        max(setting_value) filter (
            where setting_key = 'onboarding_notification_subject'
        ) as onboarding_notification_subject,
        max(setting_value) filter (
            where setting_key = 'onboarding_notification_html'
        ) as onboarding_notification_html,
        max(setting_value) filter (
            where setting_key = 'register_interest_confirmation_subject'
        ) as registration_confirmation_subject,
        max(setting_value) filter (
            where setting_key = 'register_interest_confirmation_html'
        ) as registration_confirmation_html,
        max(setting_value) filter (
            where setting_key = 'register_interest_notification_subject'
        ) as registration_notification_subject,
        max(setting_value) filter (
            where setting_key = 'register_interest_notification_html'
        ) as registration_notification_html
    from app_settings
),
templates(template_key, subject, html_body) as (
    select
        'user_onboarding',
        onboarding_confirmation_subject,
        onboarding_confirmation_html
    from legacy
    union all
    select
        'internal_onboarding_notification',
        replace(onboarding_notification_subject, '{{adminLoginId}}', '{{admin_login_id}}'),
        replace(onboarding_notification_html, '{{adminLoginId}}', '{{admin_login_id}}')
    from legacy
    union all
    select
        'registration_confirmation',
        registration_confirmation_subject,
        registration_confirmation_html
    from legacy
    union all
    select
        'new_registration_notification',
        registration_notification_subject,
        registration_notification_html
    from legacy
),
valid_templates as (
    select template_key, subject, html_body
    from templates
    where nullif(btrim(subject), '') is not null
      and nullif(btrim(html_body), '') is not null
)
insert into system_email_templates (
    template_key,
    subject,
    html_body,
    text_body,
    enabled,
    version,
    updated_at,
    updated_by
)
select
    template_key,
    subject,
    html_body,
    btrim(
        regexp_replace(
            regexp_replace(
                regexp_replace(html_body, '<br[[:space:]]*/?>', E'\n', 'gi'),
                '</(p|div|h[1-6]|li|tr)>',
                E'\n',
                'gi'
            ),
            '<[^>]+>',
            ' ',
            'g'
        )
    ),
    true,
    1,
    now(),
    'legacy-migration'
from valid_templates
on conflict (template_key) do nothing;
