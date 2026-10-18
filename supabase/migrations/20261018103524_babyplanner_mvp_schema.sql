-- BabyPlanner MVP schema. Local migration only; review before applying to any Supabase project.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  locale text not null default 'es-ES' check (locale in ('es-ES', 'ca-ES', 'en')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.pregnancies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  due_date date,
  due_date_confirmed boolean not null default false,
  conception_method text not null default 'unspecified' check (conception_method in ('unspecified', 'spontaneous', 'ivf')),
  transfer_date date,
  embryo_age_days smallint check (embryo_age_days between 0 and 10),
  embryos_transferred smallint check (embryos_transferred between 1 and 10),
  embryo_quality text check (char_length(embryo_quality) <= 40),
  clinic_name text check (char_length(clinic_name) <= 180),
  sac_status text not null default 'unknown' check (sac_status in ('unknown', 'single', 'multiple')),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check (due_date_confirmed = false or due_date is not null)
);

create unique index pregnancies_one_active_per_user_idx on public.pregnancies(user_id) where status = 'active';
create index pregnancies_user_id_idx on public.pregnancies(user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  category text not null check (category in ('appointments_tests', 'admin', 'arrival', 'shopping')),
  due_on date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  is_done boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (pregnancy_id, user_id) references public.pregnancies(id, user_id) on delete cascade
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  appointment_type text not null default 'other' check (appointment_type in ('visit', 'ultrasound', 'test', 'class', 'other')),
  starts_at timestamptz not null,
  certainty text not null default 'confirmed' check (certainty in ('confirmed', 'orientative', 'pending_confirmation')),
  place text check (char_length(place) <= 180),
  professional text check (char_length(professional) <= 180),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (pregnancy_id, user_id) references public.pregnancies(id, user_id) on delete cascade
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  category text not null default 'other' check (category in ('baby', 'parent', 'home', 'other')),
  quantity text check (char_length(quantity) <= 60),
  is_purchased boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (pregnancy_id, user_id) references public.pregnancies(id, user_id) on delete cascade
);

create table public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid not null,
  content text not null default '' check (char_length(content) <= 10000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (user_id, pregnancy_id),
  foreign key (pregnancy_id, user_id) references public.pregnancies(id, user_id) on delete cascade
);

-- Optional sensitive reproductive history. Kept separate from general screens and notes.
create table public.ivf_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid not null unique,
  history_note text not null default '' check (char_length(history_note) <= 10000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (pregnancy_id, user_id) references public.pregnancies(id, user_id) on delete cascade
);

-- Private event timeline for historical test results, appointments and notes.
create table public.pregnancy_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid not null,
  event_type text not null default 'other' check (event_type in ('transfer', 'home_test', 'lab_result', 'ultrasound', 'symptom_note', 'clinic_instruction', 'other')),
  title text not null check (char_length(title) between 1 and 180),
  occurred_on date not null,
  result_value text check (char_length(result_value) <= 120),
  result_unit text check (char_length(result_unit) <= 40),
  details text check (char_length(details) <= 5000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (pregnancy_id, user_id) references public.pregnancies(id, user_id) on delete cascade
);

create index tasks_user_due_idx on public.tasks(user_id, due_on);
create index tasks_pregnancy_created_idx on public.tasks(pregnancy_id, created_at desc);
create index tasks_pregnancy_user_idx on public.tasks(pregnancy_id, user_id);
create index appointments_user_starts_idx on public.appointments(user_id, starts_at);
create index appointments_pregnancy_starts_idx on public.appointments(pregnancy_id, starts_at);
create index appointments_pregnancy_user_idx on public.appointments(pregnancy_id, user_id);
create index shopping_items_user_created_idx on public.shopping_items(user_id, created_at desc);
create index shopping_items_pregnancy_created_idx on public.shopping_items(pregnancy_id, created_at desc);
create index shopping_items_pregnancy_user_idx on public.shopping_items(pregnancy_id, user_id);
create index personal_notes_pregnancy_user_idx on public.personal_notes(pregnancy_id, user_id);
create index ivf_history_user_pregnancy_idx on public.ivf_history(user_id, pregnancy_id);
create index pregnancy_events_user_date_idx on public.pregnancy_events(user_id, occurred_on desc);
create index pregnancy_events_pregnancy_user_idx on public.pregnancy_events(pregnancy_id, user_id);

create schema babyplanner_internal;
revoke all on schema babyplanner_internal from public, anon, authenticated;
create function babyplanner_internal.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function babyplanner_internal.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function babyplanner_internal.set_updated_at();
create trigger pregnancies_set_updated_at before update on public.pregnancies for each row execute function babyplanner_internal.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function babyplanner_internal.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments for each row execute function babyplanner_internal.set_updated_at();
create trigger shopping_items_set_updated_at before update on public.shopping_items for each row execute function babyplanner_internal.set_updated_at();
create trigger personal_notes_set_updated_at before update on public.personal_notes for each row execute function babyplanner_internal.set_updated_at();
create trigger ivf_history_set_updated_at before update on public.ivf_history for each row execute function babyplanner_internal.set_updated_at();
create trigger pregnancy_events_set_updated_at before update on public.pregnancy_events for each row execute function babyplanner_internal.set_updated_at();

alter table public.profiles enable row level security;
alter table public.pregnancies enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.shopping_items enable row level security;
alter table public.personal_notes enable row level security;
alter table public.ivf_history enable row level security;
alter table public.pregnancy_events enable row level security;

revoke all on table public.profiles, public.pregnancies, public.tasks, public.appointments, public.shopping_items, public.personal_notes, public.ivf_history, public.pregnancy_events from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles, public.pregnancies, public.tasks, public.appointments, public.shopping_items, public.personal_notes, public.ivf_history, public.pregnancy_events to authenticated;

create policy "Profiles select own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Profiles insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Profiles update own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Profiles delete own" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

create policy "Pregnancies select own" on public.pregnancies for select to authenticated using ((select auth.uid()) = user_id);
create policy "Pregnancies insert own" on public.pregnancies for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Pregnancies update own" on public.pregnancies for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Pregnancies delete own" on public.pregnancies for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Tasks select own" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Tasks insert own" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Tasks update own" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Tasks delete own" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Appointments select own" on public.appointments for select to authenticated using ((select auth.uid()) = user_id);
create policy "Appointments insert own" on public.appointments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Appointments update own" on public.appointments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Appointments delete own" on public.appointments for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Shopping items select own" on public.shopping_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "Shopping items insert own" on public.shopping_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Shopping items update own" on public.shopping_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Shopping items delete own" on public.shopping_items for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Personal notes select own" on public.personal_notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Personal notes insert own" on public.personal_notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Personal notes update own" on public.personal_notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Personal notes delete own" on public.personal_notes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "IVF history select own" on public.ivf_history for select to authenticated using ((select auth.uid()) = user_id);
create policy "IVF history insert own" on public.ivf_history for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "IVF history update own" on public.ivf_history for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "IVF history delete own" on public.ivf_history for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Pregnancy events select own" on public.pregnancy_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "Pregnancy events insert own" on public.pregnancy_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Pregnancy events update own" on public.pregnancy_events for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Pregnancy events delete own" on public.pregnancy_events for delete to authenticated using ((select auth.uid()) = user_id);
