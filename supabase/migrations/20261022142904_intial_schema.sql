create type public.user_role as enum (
  'resident',
  'response_team',
  'coordinator',
  'finance',
  'auditor',
  'admin'
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'resident',
  organisation_id uuid references public.organisations (id),
  created_at timestamptz not null default now(),
  constraint staff_need_organisation
    check (role = 'resident' or organisation_id is not null)
);

create index profiles_organisation_id_idx
  on public.profiles (organisation_id);

-- These SECURITY DEFINER helpers can read profiles without triggering
-- the caller's profile RLS policies.
create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
$$;

create function public.current_user_org()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organisation_id
  from public.profiles as p
  where p.id = auth.uid()
$$;

create function public.current_user_org_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    join public.organisations as o on o.id = p.organisation_id
    where p.id = auth.uid()
      and o.is_active
  )
$$;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_user_org() from public, anon;
revoke all on function public.current_user_org_is_active() from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_org() to authenticated;
grant execute on function public.current_user_org_is_active() to authenticated;

-- Prevent row-level deletes through ordinary SQL/API access.
create function public.block_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Deleting from % is not allowed', tg_table_name;
end;
$$;

revoke all on function public.block_delete() from public, anon, authenticated;

create trigger organisations_no_delete
  before delete on public.organisations
  for each row execute function public.block_delete();

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;

-- Grants limit operations; RLS below limits which rows are visible or writable.
revoke all on public.profiles, public.organisations from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.organisations to authenticated;
grant insert (name, is_active) on public.organisations to authenticated;
grant update (name, is_active) on public.organisations to authenticated;

create policy "Read permitted profiles"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.current_user_role() = 'admin'
    or (
      public.current_user_role() is not null
      and public.current_user_role() <> 'resident'
      and organisation_id = public.current_user_org()
      and public.current_user_org_is_active()
    )
  );

create policy "Read own organisation"
  on public.organisations for select
  using (id = public.current_user_org());

create policy "Admins read all organisations"
  on public.organisations for select
  using (public.current_user_role() = 'admin');

create policy "Admins create organisations"
  on public.organisations for insert
  with check (public.current_user_role() = 'admin');

create policy "Admins update organisations"
  on public.organisations for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');