-- Add photo diary metadata without changing or deleting existing photo records.
alter table public.pregnancy_photos
  add column if not exists captured_on date,
  add column if not exists pregnancy_week smallint,
  add column if not exists stage text,
  add column if not exists tags text[] not null default array[]::text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pregnancy_photos_week_range_check') then
    alter table public.pregnancy_photos add constraint pregnancy_photos_week_range_check
      check (pregnancy_week is null or pregnancy_week between 1 and 42);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pregnancy_photos_stage_check') then
    alter table public.pregnancy_photos add constraint pregnancy_photos_stage_check
      check (stage is null or stage in ('first_trimester', 'second_trimester', 'third_trimester'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pregnancy_photos_tag_count_check') then
    alter table public.pregnancy_photos add constraint pregnancy_photos_tag_count_check
      check (cardinality(tags) <= 12 and array_position(tags, null) is null);
  end if;
end;
$$;

create index if not exists pregnancy_photos_capture_date_idx
  on public.pregnancy_photos (pregnancy_id, captured_on desc);
create index if not exists pregnancy_photos_tags_idx
  on public.pregnancy_photos using gin (tags);
