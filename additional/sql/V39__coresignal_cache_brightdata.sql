-- Bright Data replaces CoreSignal as the external-candidate data source.
-- coresignal_cache keeps its name/shape; Bright Data record IDs are string
-- slugs (e.g. "mavi-packer-1a7b77138"), not numeric, so coresignal_id is
-- widened to text. Avatar support adds two new nullable columns.

alter table coresignal_cache alter column coresignal_id type text using coresignal_id::text;

alter table coresignal_cache add column if not exists avatar_url text;
alter table coresignal_cache add column if not exists default_avatar boolean;
