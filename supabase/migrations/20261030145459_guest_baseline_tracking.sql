-- Baseline access for every accepted family invitation: Inicio and the complete
-- week-by-week educational tracking view. Optional data sections still use
-- their existing RLS permissions. No invitation or pregnancy rows are rewritten.
create or replace function public.get_shared_pregnancy(target_pregnancy_id uuid)
returns table (id uuid, due_date date, due_date_confirmed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.due_date, p.due_date_confirmed
  from public.pregnancies p
  join public.pregnancy_collaborators c on c.pregnancy_id = p.id
  where p.id = target_pregnancy_id
    and c.member_user_id = (select auth.uid())
    and c.invitation_status = 'accepted';
$$;