-- Allow explicitly invited family members to view and manage appointments.
-- Existing appointments and invitation records are preserved. Existing shares
-- keep this permission disabled until the owner enables it.

alter table public.pregnancy_collaborators
  add column if not exists can_manage_appointments boolean not null default false;

create policy "Family can view shared appointments" on public.appointments
  for select to authenticated using (exists (
    select 1 from public.pregnancy_collaborators c
    where c.pregnancy_id = appointments.pregnancy_id
      and c.owner_id = appointments.user_id
      and c.member_user_id = (select auth.uid())
      and c.invitation_status = 'accepted'
      and c.can_manage_appointments
  ));

create policy "Family can add shared appointments" on public.appointments
  for insert to authenticated with check (exists (
    select 1 from public.pregnancy_collaborators c
    where c.pregnancy_id = appointments.pregnancy_id
      and c.owner_id = appointments.user_id
      and c.member_user_id = (select auth.uid())
      and c.invitation_status = 'accepted'
      and c.can_manage_appointments
  ));

create policy "Family can edit shared appointments" on public.appointments
  for update to authenticated using (exists (
    select 1 from public.pregnancy_collaborators c
    where c.pregnancy_id = appointments.pregnancy_id
      and c.owner_id = appointments.user_id
      and c.member_user_id = (select auth.uid())
      and c.invitation_status = 'accepted'
      and c.can_manage_appointments
  )) with check (exists (
    select 1 from public.pregnancy_collaborators c
    where c.pregnancy_id = appointments.pregnancy_id
      and c.owner_id = appointments.user_id
      and c.member_user_id = (select auth.uid())
      and c.invitation_status = 'accepted'
      and c.can_manage_appointments
  ));

create policy "Family can delete shared appointments" on public.appointments
  for delete to authenticated using (exists (
    select 1 from public.pregnancy_collaborators c
    where c.pregnancy_id = appointments.pregnancy_id
      and c.owner_id = appointments.user_id
      and c.member_user_id = (select auth.uid())
      and c.invitation_status = 'accepted'
      and c.can_manage_appointments
  ));

-- Keep the existing activity log trigger compatible with delegated appointment
-- edits. The history row remains owned by the pregnancy owner; tasks stay owner-only.
create or replace function babyplanner_internal.log_planner_change()
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

  if (select auth.uid()) is not null
     and (select auth.uid()) is distinct from row_user_id
     and not (
       tg_table_name = 'appointments'
       and exists (
         select 1 from public.pregnancy_collaborators c
         where c.pregnancy_id = row_pregnancy_id
           and c.owner_id = row_user_id
           and c.member_user_id = (select auth.uid())
           and c.invitation_status = 'accepted'
           and c.can_manage_appointments
       )
     ) then
    raise exception 'Activity log owner does not match the authenticated user or an accepted appointment collaborator';
  end if;

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

-- Appointments-only shares must also be allowed through the minimal pregnancy RPC.
create or replace function public.get_shared_pregnancy(target_pregnancy_id uuid)
returns table (id uuid, due_date date, due_date_confirmed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
    case when c.can_view_tracking then p.due_date else null end,
    case when c.can_view_tracking then p.due_date_confirmed else false end
  from public.pregnancies p
  join public.pregnancy_collaborators c on c.pregnancy_id = p.id
  where p.id = target_pregnancy_id
    and c.member_user_id = auth.uid()
    and c.invitation_status = 'accepted'
    and (c.can_view_tracking or c.can_manage_shopping or c.can_view_photos or c.can_manage_appointments);
$$;
