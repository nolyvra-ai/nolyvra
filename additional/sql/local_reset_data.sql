-- Local development only.
-- Clears runtime/test data while keeping schema, migrations, plans, and login rows.

\set ON_ERROR_STOP on

begin;

truncate table
    activity_timeline,
    analyses,
    analysis_jobs,
    candidates,
    coresignal_cache,
    coworker_messages,
    coworker_tasks,
    email_history,
    email_templates,
    interview_transcripts,
    interviews,
    jobs,
    oauth_tokens,
    reminders,
    user_sessions
restart identity cascade;

commit;
