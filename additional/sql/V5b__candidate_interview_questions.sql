-- Add interview_questions column to candidates table
-- Stores a plain-text block of recruiter-editable interview questions
alter table candidates add column if not exists interview_questions text;

-- Make interview_id nullable on interview_transcripts
-- (analysis may be submitted without linking to a specific scheduled interview)
alter table interview_transcripts alter column interview_id drop not null;
