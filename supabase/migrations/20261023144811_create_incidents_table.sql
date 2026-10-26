-- PostGIS (location data)
create extension if not exists postgis;


create type public.incident_status as enum (
  'reported', 'under_review', 'verified', 'assigned',
  'dispatched', 'completed', 'rejected', 'needs_follow_up'
);
create type public.incident_priority as enum ('low', 'medium', 'high', 'critical');

-- Keeps updated_at current on every change
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;


create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  organisation_id uuid references public.organisations (id) on delete set null,
  title text not null
    check (title ~ '\S' and char_length(title) between 3 and 120),
  description text not null
    check (description ~ '\S' and char_length(description) between 3 and 2000),
  category text not null
    check (category ~ '\S' and char_length(category) between 2 and 50),
  status public.incident_status not null default 'reported',
  priority public.incident_priority not null default 'medium',

  
  location geography(point, 4326) not null,

  -- Plain numbers for Leaflet, derived automatically from location
  latitude  double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,

  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Verification fields: both set or both empty; empty before review or
  -- after rejection; required once verified or later.
  -- needs_follow_up may be either (it can happen before or after verification).
  constraint verified_fields_consistent check (
    (verified_by is null) = (verified_at is null)
    and (status not in ('reported', 'under_review', 'rejected')
         or verified_by is null)
    and (status not in ('verified', 'assigned', 'dispatched', 'completed')
         or verified_by is not null)
  )
);


create index incidents_reporter_idx on public.incidents (reporter_id);
create index incidents_organisation_idx on public.incidents (organisation_id);
create index incidents_status_idx on public.incidents (status);
create index incidents_location_idx on public.incidents using gist (location);


create trigger incidents_no_delete
  before delete on public.incidents
  for each row execute function public.block_delete();

create trigger set_incidents_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();


alter table public.incidents enable row level security;
revoke all on public.incidents from anon, authenticated;
grant select on public.incidents to authenticated;
grant insert (reporter_id, title, description, category, location)
  on public.incidents to authenticated;


create policy "Residents create incidents"
  on public.incidents for insert
  with check (
    auth.uid() = reporter_id
    and public.current_user_role() = 'resident'
    and status = 'reported'
    and organisation_id is null
    and verified_by is null
  );

create policy "Residents read own incidents"
  on public.incidents for select
  using (auth.uid() = reporter_id);

-- Unrouted reports are a triage queue, so coordinators see them across
-- organisations, even before the report belongs to any organisation.

create policy "Coordinators read unrouted incidents"
  on public.incidents for select
  using (public.current_user_role() = 'coordinator'
         and organisation_id is null);

create policy "Staff read own organisation incidents"
  on public.incidents for select
  using (public.current_user_role() <> 'resident'
         and organisation_id = public.current_user_org()
         and public.current_user_org_is_active());

-- Public view: verified incidents only, rounded location, no free text.
-- Runs with the owner's rights on purpose, so anonymous visitors can read it.
create view public.public_incidents as
select id, category, status, created_at,
       round(st_y(location::geometry)::numeric, 2) as approx_latitude,
       round(st_x(location::geometry)::numeric, 2) as approx_longitude
from public.incidents
where status in ('verified', 'assigned', 'dispatched', 'completed');

grant select on public.public_incidents to anon, authenticated;