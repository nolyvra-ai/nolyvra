-- ============================================================
-- V5: Interview transcript + AI analysis table
-- Run this manually in psql or your DB client
-- ============================================================

create table interview_transcripts (
    id                        text         primary key,          -- "itrans-{uuid}"
    interview_id              text         references interviews(id) on delete cascade,  -- nullable: analysis may not be linked to a specific interview
    candidate_id              text         not null references candidates(id) on delete cascade,
    login_id                  text         not null references login(id) on delete cascade,

    -- Transcript raw text (either fetched from Google Meet or pasted manually)
    transcript_text           text,
    transcript_source         text         not null default 'MANUAL',  -- MANUAL | GOOGLE_MEET
    fetched_at                timestamptz,

    -- AI Analysis scores
    overall_sentiment         text,        -- Positive | Neutral | Negative
    sentiment_score           integer,     -- 0-100
    communication_score       integer,     -- 0-100
    technical_score           integer,     -- 0-100
    cultural_fit_score        integer,     -- 0-100
    confidence_level          text,        -- High | Medium | Low

    -- AI Analysis structured data
    key_strengths             jsonb        not null default '[]',
    areas_of_concern          jsonb        not null default '[]',
    notable_moments           jsonb        not null default '[]',
    interview_summary         text,
    hiring_recommendation     text,        -- Strong Yes | Yes | Maybe | No | Strong No

    -- CV vs interview alignment (only populated when CV analysis exists)
    cv_alignment_insights     jsonb        not null default '[]',

    -- Full OpenAI response for future re-parsing
    analysis_json             jsonb,
    analyzed_at               timestamptz,

    created_at                timestamptz  not null default now()
);

-- Only one analysis record per interview (upsert on re-analysis)
create unique index uidx_itrans_interview_id on interview_transcripts(interview_id);

create index idx_itrans_candidate_id on interview_transcripts(candidate_id);
create index idx_itrans_login_id     on interview_transcripts(login_id);
create index idx_itrans_analyzed_at  on interview_transcripts(analyzed_at desc);
