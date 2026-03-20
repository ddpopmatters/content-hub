-- Fix: migration 013 was recorded as applied but columns are missing from the remote schema.
-- This migration re-applies all columns from 013_add_entry_strategy_metadata.sql safely.
alter table public.entries
  add column if not exists content_category text,
  add column if not exists response_mode text,
  add column if not exists sign_off_route text,
  add column if not exists content_peak text,
  add column if not exists series_name text,
  add column if not exists episode_number integer,
  add column if not exists origin_content_id text,
  add column if not exists partner_org text,
  add column if not exists alt_text_status text,
  add column if not exists subtitles_status text,
  add column if not exists utm_status text,
  add column if not exists source_verified boolean,
  add column if not exists seo_primary_query text,
  add column if not exists link_placement text,
  add column if not exists cta_type text;

create index if not exists entries_content_category_idx on public.entries (content_category);
create index if not exists entries_response_mode_idx on public.entries (response_mode);
create index if not exists entries_series_name_idx on public.entries (series_name);
