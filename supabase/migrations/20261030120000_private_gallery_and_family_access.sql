-- Private family gallery and least-privilege sharing.
-- Additive only: existing pregnancy and activity records are not rewritten or deleted.

create table public.pregnancy_collaborators (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references public.pregnancies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null check (char_length(invited_email) between 3 and 320),
  member_user_id uuid references auth.users(id) on delete set null,
  can_view_tracking boolean not null default true,
  can_manage_shopping boolean not null default false,
  can_view_photos boolean not null default false,
  invitation_status text not null default 'pending' check (invitation_status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pregnancy_id, invited_email),
  foreign key (pregnancy_id, owner_id) references public.pregnancies(id, user_id) on delete cascade
);
create index pregnancy_collaborators_member_idx on public.pregnancy_collaborators(member_user_id, pregnancy_id);

create table public.pregnancy_photos (
  id uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references public.pregnancies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('bump', 'gifts', 'ideas', 'other')),
  storage_path text not null unique,
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  foreign key (pregnancy_id, owner_id) references public.pregnancies(id, user_id) on delete cascade
);
create index pregnancy_photos_pregnancy_created_idx on public.pregnancy_photos(pregnancy_id, created_at desc);

alter table public.pregnancy_collaborators enable row level security;
alter table public.pregnancy_photos enable row level security;
revoke all on public.pregnancy_collaborators, public.pregnancy_photos from public, anon, authenticated;
grant select, insert, update, delete on public.pregnancy_collaborators to authenticated;
grant select, insert, update, delete on public.pregnancy_photos to authenticated;

create policy "Owners manage collaborators" on public.pregnancy_collaborators
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.pregnancies p where p.id = pregnancy_id and p.user_id = (select auth.uid())
  ));
create policy "Invitees see their own invitations" on public.pregnancy_collaborators
  for select to authenticated using (
    lower(invited_email) = lower(coalesce((select auth.jwt())->>'email', '')) or member_user_id = (select auth.uid())
  );

-- The invitee cannot update permission columns directly. This function only binds the
-- authenticated account to an invitation addressed to that account's verified email.
create function public.accept_pregnancy_invitation(invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'email', '') = '' then
    return false;
  end if;
  update public.pregnancy_collaborators c
  set member_user_id = auth.uid(), invitation_status = 'accepted', updated_at = pg_catalog.now()
  where c.id = invitation_id
    and c.invitation_status = 'pending'
    and pg_catalog.lower(c.invited_email) = pg_catalog.lower(auth.jwt()->>'email');
  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;
revoke all on function public.accept_pregnancy_invitation(uuid) from public, anon;
grant execute on function public.accept_pregnancy_invitation(uuid) to authenticated;

-- Share only the fields needed to display tracking; IVF and clinic details stay private.
create function public.get_shared_pregnancy(target_pregnancy_id uuid)
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
    and (c.can_view_tracking or c.can_manage_shopping or c.can_view_photos);
$$;
revoke all on function public.get_shared_pregnancy(uuid) from public, anon;
grant execute on function public.get_shared_pregnancy(uuid) to authenticated;

create policy "Owners and invited family view photos" on public.pregnancy_photos
  for select to authenticated using (
    owner_id = (select auth.uid()) or exists (
      select 1 from public.pregnancy_collaborators c where c.pregnancy_id = pregnancy_photos.pregnancy_id
        and c.member_user_id = (select auth.uid()) and c.invitation_status = 'accepted' and c.can_view_photos
    )
  );
create policy "Owners and invited family upload photos" on public.pregnancy_photos
  for insert to authenticated with check (
    uploaded_by = (select auth.uid()) and (
      owner_id = (select auth.uid()) or exists (
        select 1 from public.pregnancy_collaborators c where c.pregnancy_id = pregnancy_photos.pregnancy_id
          and c.member_user_id = (select auth.uid()) and c.invitation_status = 'accepted' and c.can_view_photos
      )
    )
  );
create policy "Owners remove photos" on public.pregnancy_photos
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Shopping additions/edits are shared only when the owner explicitly enables that permission.
create policy "Family can view shared shopping" on public.shopping_items
  for select to authenticated using (exists (
    select 1 from public.pregnancy_collaborators c where c.pregnancy_id = shopping_items.pregnancy_id
      and c.member_user_id = (select auth.uid()) and c.invitation_status = 'accepted' and c.can_manage_shopping
  ));
create policy "Family can add shared shopping" on public.shopping_items
  for insert to authenticated with check (exists (
    select 1 from public.pregnancy_collaborators c where c.pregnancy_id = shopping_items.pregnancy_id
      and c.owner_id = shopping_items.user_id and c.member_user_id = (select auth.uid())
      and c.invitation_status = 'accepted' and c.can_manage_shopping
  ));
create policy "Family can update shared shopping" on public.shopping_items
  for update to authenticated using (exists (
    select 1 from public.pregnancy_collaborators c where c.pregnancy_id = shopping_items.pregnancy_id
      and c.member_user_id = (select auth.uid()) and c.invitation_status = 'accepted' and c.can_manage_shopping
  )) with check (exists (
    select 1 from public.pregnancy_collaborators c where c.pregnancy_id = shopping_items.pregnancy_id
      and c.member_user_id = (select auth.uid()) and c.invitation_status = 'accepted' and c.can_manage_shopping
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pregnancy-photos', 'pregnancy-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;
do $$
begin
  if exists (select 1 from storage.buckets where id = 'pregnancy-photos' and public) then
    raise exception 'The pregnancy-photos bucket already exists as public; review it before applying this migration.';
  end if;
end;
$$;
create policy "Members read pregnancy photos in private bucket" on storage.objects
  for select to authenticated using (
    bucket_id = 'pregnancy-photos' and exists (
      select 1 from public.pregnancy_photos p where p.storage_path = name
        and (p.owner_id = (select auth.uid()) or exists (
          select 1 from public.pregnancy_collaborators c where c.pregnancy_id = p.pregnancy_id
            and c.member_user_id = (select auth.uid()) and c.invitation_status = 'accepted' and c.can_view_photos
        ))
    )
  );
create policy "Members upload into their pregnancy folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'pregnancy-photos' and exists (
      select 1 from public.pregnancies p where (storage.foldername(name))[1] = p.id::text and (
        p.user_id = (select auth.uid()) or exists (
          select 1 from public.pregnancy_collaborators c where c.pregnancy_id = p.id
            and c.member_user_id = (select auth.uid()) and c.invitation_status = 'accepted' and c.can_view_photos
        )
      )
    )
  );
create policy "Owners delete photos from storage" on storage.objects
  for delete to authenticated using (
    bucket_id = 'pregnancy-photos' and exists (
      select 1 from public.pregnancy_photos p where p.storage_path = name and p.owner_id = (select auth.uid())
    )
  );
