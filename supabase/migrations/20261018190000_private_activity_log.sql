-- Append-only, private audit history for task and appointment changes.
-- This migration is local only and must be reviewed before remote application.

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pregnancy_id uuid not null,
  entity_type text not null check (entity_type in ('tasks', 'appointments')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  entity_title text not null check (char_length(entity_title) between 1 and 180),
  before_snapshot jsonb,
  after_snapshot jsonb,
  changed_at timestamptz not null default pg_catalog.now(),
  foreign key (pregnancy_id, user_id) references public.pregnancies(id, user_id) on delete cascade
);

create index activity_log_pregnancy_changed_idx on public.activity_log(pregnancy_id, changed_at desc);
create index activity_log_user_changed_idx on public.activity_log(user_id, changed_at desc);

alter table public.activity_log enable row level security;
revoke all on table public.activity_log from public, anon, authenticated;
grant select on table public.activity_log to authenticated;
create policy "Activity log select own" on public.activity_log for select to authenticated using ((select auth.uid()) = user_id);

create function babyplanner_internal.log_planner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  row_data jsonb;
  row_user_id uuid;
  row_pregnancy_id uuid;
  row_id uuid;
  row_action text;
begin
  if tg_op = 'DELETE' then
    old_row := pg_catalog.to_jsonb(old);
    row_data := old_row;
    row_user_id := old.user_id;
    row_pregnancy_id := old.pregnancy_id;
    row_id := old.id;
    row_action := 'deleted';
  else
    new_row := pg_catalog.to_jsonb(new);
    row_data := new_row;
    row_user_id := new.user_id;
    row_pregnancy_id := new.pregnancy_id;
    row_id := new.id;
    if tg_op = 'INSERT' then
      row_action := 'created';
    else
      old_row := pg_catalog.to_jsonb(old);
      if (new_row - 'updated_at') is not distinct from (old_row - 'updated_at') then
        return new;
      end if;
      row_action := 'updated';
    end if;
  end if;

  -- Authenticated requests must match the row owner. Null auth.uid() can occur
  -- for trusted administrative operations (for example deleting an auth user).
  if (select auth.uid()) is not null
     and (select auth.uid()) is distinct from row_user_id then
    raise exception 'Activity log owner does not match the authenticated user';
  end if;

  -- Skip cascade deletes when the whole pregnancy profile is being removed.
  if tg_op <> 'DELETE' or exists (
    select 1 from public.pregnancies p where p.id = row_pregnancy_id and p.user_id = row_user_id
  ) then
    insert into public.activity_log (
      user_id, pregnancy_id, entity_type, entity_id, action, entity_title,
      before_snapshot, after_snapshot
    ) values (
      row_user_id, row_pregnancy_id,
      case tg_table_name when 'tasks' then 'tasks' else 'appointments' end,
      row_id, row_action,
      coalesce(row_data ->> 'title', 'Elemento sin título'),
      case when tg_op = 'INSERT' then null else old_row end,
      case when tg_op = 'DELETE' then null else new_row end
    );
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function babyplanner_internal.log_planner_change() from public, anon, authenticated;

create trigger tasks_log_activity
after insert or update or delete on public.tasks
for each row execute function babyplanner_internal.log_planner_change();

create trigger appointments_log_activity
after insert or update or delete on public.appointments
for each row execute function babyplanner_internal.log_planner_change();
