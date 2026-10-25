create type public.volunteer_availability as enum ('available', 'limited', 'unavailable');
create type public.volunteer_task_status as enum
  ('assigned', 'accepted', 'in_progress', 'completed', 'declined', 'cancelled');

create table public.volunteers (
  user_id uuid primary key references public.profiles (id),
  area text not null check (area ~ '\S' and area = btrim(area) and char_length(area) <= 100),
  skills text[] not null default '{}'
    check (cardinality(skills) <= 10
           and char_length(array_to_string(skills, ',')) <= 200
           and array_position(skills, null) is null
           and array_position(skills, '') is null),
  availability public.volunteer_availability not null default 'available',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.volunteer_contacts (
  user_id uuid primary key references public.volunteers (user_id),
  phone text not null
    check (phone = btrim(phone)
           and phone ~ '^\+?[0-9 ]+$'
           and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15)
);

create table public.volunteer_tasks (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers (user_id),
  organisation_id uuid not null references public.organisations (id),
  incident_id uuid references public.incidents (id),
  created_by uuid references public.profiles (id) on delete set null,
  title text not null check (title ~ '\S' and char_length(title) <= 100),
  instructions text check (instructions is null or char_length(instructions) <= 500),
  status public.volunteer_task_status not null default 'assigned',
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index volunteer_tasks_volunteer_idx on public.volunteer_tasks (volunteer_id, status);
create index volunteer_tasks_org_idx on public.volunteer_tasks (organisation_id, status);

create trigger volunteers_no_delete before delete on public.volunteers
  for each row execute function public.block_delete();
create trigger volunteer_contacts_no_delete before delete on public.volunteer_contacts
  for each row execute function public.block_delete();
create trigger volunteer_tasks_no_delete before delete on public.volunteer_tasks
  for each row execute function public.block_delete();
create trigger volunteers_updated_at before update on public.volunteers
  for each row execute function public.set_updated_at();
create trigger volunteer_tasks_updated_at before update on public.volunteer_tasks
  for each row execute function public.set_updated_at();

alter table public.volunteers enable row level security;
alter table public.volunteer_contacts enable row level security;
alter table public.volunteer_tasks enable row level security;
revoke all on public.volunteers, public.volunteer_contacts, public.volunteer_tasks
  from anon, authenticated;
grant select on public.volunteers, public.volunteer_contacts, public.volunteer_tasks
  to authenticated;

create policy "Volunteers read self, coordinators read directory"
  on public.volunteers for select
  using (user_id = auth.uid()
         or (public.current_user_role() = 'coordinator'
             and public.current_user_org_is_active()));

create policy "Phone visible to self, or to a coordinator with an open task for them"
  on public.volunteer_contacts for select
  using (user_id = auth.uid()
         or (public.current_user_role() = 'coordinator'
             and public.current_user_org_is_active()
             and exists (
               select 1 from public.volunteer_tasks t
               where t.volunteer_id = volunteer_contacts.user_id
                 and t.organisation_id = public.current_user_org()
                 and t.status in ('assigned', 'accepted', 'in_progress'))));

create policy "Volunteers read own tasks, coordinators read own organisation"
  on public.volunteer_tasks for select
  using (volunteer_id = auth.uid()
         or (public.current_user_role() = 'coordinator'
             and organisation_id = public.current_user_org()
             and public.current_user_org_is_active()));

create function public.register_volunteer(
  p_phone text,
  p_area text,
  p_skills text[] default '{}',
  p_availability public.volunteer_availability default 'available',
  p_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := btrim(p_phone);
  v_area text := btrim(p_area);
  v_skills text[];
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if coalesce(v_phone, '') !~ '^\+?[0-9 ]+$'
     or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 7 and 15 then
    raise exception 'Enter a valid phone number (7 to 15 digits)';
  end if;
  if coalesce(v_area, '') = '' or char_length(v_area) > 100 then
    raise exception 'Area is required (up to 100 characters)';
  end if;

  select coalesce(array_agg(t.s order by t.o), '{}') into v_skills
  from (
    select btrim(x) as s, min(o) as o
    from unnest(coalesce(p_skills, '{}')) with ordinality as u(x, o)
    where btrim(x) <> ''
    group by btrim(x)
  ) t;

  if cardinality(v_skills) > 10
     or exists (select 1 from unnest(v_skills) k where char_length(k) > 30)
     or char_length(array_to_string(v_skills, ',')) > 200 then
    raise exception 'Up to 10 skills, 30 characters each, 200 characters in total';
  end if;

  insert into public.volunteers (user_id, area, skills, availability, active)
  values (auth.uid(), v_area, v_skills, p_availability, p_active)
  on conflict (user_id) do update
    set area = excluded.area, skills = excluded.skills,
        availability = excluded.availability, active = excluded.active;

  insert into public.volunteer_contacts (user_id, phone)
  values (auth.uid(), v_phone)
  on conflict (user_id) do update set phone = excluded.phone;
end;
$$;

create function public.create_volunteer_task(
  p_volunteer_id uuid,
  p_title text,
  p_instructions text default null,
  p_incident_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_org();
  v_id uuid;
begin
  if v_role is null then raise exception 'Not signed in'; end if;
  if v_role <> 'coordinator' then
    raise exception 'Only coordinators can assign volunteer tasks';
  end if;
  if not public.current_user_org_is_active() then
    raise exception 'Your organisation is not active';
  end if;
  if coalesce(p_title, '') !~ '\S' or char_length(p_title) > 100 then
    raise exception 'Title is required (up to 100 characters)';
  end if;
  if p_instructions is not null and char_length(p_instructions) > 500 then
    raise exception 'Instructions must be 500 characters or fewer';
  end if;
  if not exists (
    select 1 from public.volunteers
    where user_id = p_volunteer_id and active and availability <> 'unavailable'
  ) then
    raise exception 'Volunteer not found, inactive or unavailable';
  end if;
  if p_incident_id is not null and not exists (
    select 1 from public.incidents
    where id = p_incident_id and organisation_id = v_org
      and status in ('verified', 'assigned', 'dispatched')
  ) then
    raise exception 'Incident must be verified and in your organisation';
  end if;

  insert into public.volunteer_tasks
    (volunteer_id, organisation_id, incident_id, created_by, title, instructions)
  values (p_volunteer_id, v_org, p_incident_id, auth.uid(), p_title, p_instructions)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.update_volunteer_task_status(
  p_task_id uuid,
  p_new_status public.volunteer_task_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.volunteer_tasks%rowtype;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select * into v_t from public.volunteer_tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;

  if v_t.volunteer_id = auth.uid() then
    if p_new_status not in ('accepted', 'declined', 'in_progress', 'completed') then
      raise exception 'Volunteers cannot set status %', p_new_status;
    end if;
  elsif public.current_user_role() = 'coordinator'
        and v_t.organisation_id = public.current_user_org()
        and public.current_user_org_is_active() then
    if p_new_status <> 'cancelled' then
      raise exception 'Coordinators can only cancel volunteer tasks';
    end if;
  else
    raise exception 'You cannot change this task';
  end if;

  if not (
    (v_t.status = 'assigned'    and p_new_status in ('accepted', 'declined', 'cancelled'))
 or (v_t.status = 'accepted'    and p_new_status in ('in_progress', 'cancelled'))
 or (v_t.status = 'in_progress' and p_new_status in ('completed', 'cancelled'))
  ) then
    raise exception 'Invalid change: % to %', v_t.status, p_new_status;
  end if;

  update public.volunteer_tasks
  set status = p_new_status,
      accepted_at = case when p_new_status = 'accepted' then now() else accepted_at end,
      completed_at = case when p_new_status = 'completed' then now() else completed_at end
  where id = p_task_id;
end;
$$;

revoke all on function public.register_volunteer(text, text, text[], public.volunteer_availability, boolean) from public, anon;
revoke all on function public.create_volunteer_task(uuid, text, text, uuid) from public, anon;
revoke all on function public.update_volunteer_task_status(uuid, public.volunteer_task_status) from public, anon;
grant execute on function public.register_volunteer(text, text, text[], public.volunteer_availability, boolean) to authenticated;
grant execute on function public.create_volunteer_task(uuid, text, text, uuid) to authenticated;
grant execute on function public.update_volunteer_task_status(uuid, public.volunteer_task_status) to authenticated;