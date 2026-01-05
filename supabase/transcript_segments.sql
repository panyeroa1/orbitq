-- Recommended: Run 'DROP TABLE public.transcript_segments;' first if you need to recreate with new constraints.

create table if not exists public.transcript_segments (
  id uuid not null default gen_random_uuid (),
  meeting_id text not null,
  speaker_id text null,
  source_lang text null,
  source_text text not null,
  created_at timestamp with time zone null default now(),
  target_lang text null,
  translated_text text null,
  full_transcription text null default ''::text,
  last_segment_id text null,
  constraint transcript_segments_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_transcript_segments_meeting on public.transcript_segments using btree (meeting_id) TABLESPACE pg_default;

-- Enable Realtime for this table
alter publication supabase_realtime add table public.transcript_segments;
