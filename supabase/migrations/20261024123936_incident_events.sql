
create table public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  old_status public.incident_status,
  new_status public.incident_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index incident_events_incident_idx
  on public.incident_events (incident_id, created_at);


create or replace function public.block_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Updating % is not allowed', tg_table_name;
end;
$$;

revoke all on function public.block_update() from public, anon, authenticated;

create trigger incident_events_no_update
  before update on public.incident_events
  for each row execute function public.block_update();

create trigger incident_events_no_delete
  before delete on public.incident_events
  for each row execute function public.block_delete();

-- Lock and privileges: read only through the API
alter table public.incident_events enable row level security;
revoke all on public.incident_events from anon, authenticated;
grant select on public.incident_events to authenticated;

-- You can read an event only if you can already read its incident
create policy "Read events of visible incidents"
  on public.incident_events for select
  using (exists (
    select 1 from public.incidents i where i.id = incident_id
  ));

-- Log the first event automatically when a report is created
create function public.log_incident_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.incident_events (incident_id, old_status, new_status, changed_by)
  values (new.id, null, new.status, new.reporter_id);
  return new;
end;
$$;

revoke all on function public.log_incident_created() from public, anon, authenticated;

create trigger incidents_log_created
  after insert on public.incidents
  for each row execute function public.log_incident_created();

-- The only way to change a status: checks role, order, org; logs the event
create function public.set_incident_status(
  p_incident_id uuid,
  p_new_status public.incident_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.incidents%rowtype;
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_org();
begin
  if v_role is null then
    raise exception 'Not signed in';
  end if;

  -- Validate note length
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note must be 500 characters or fewer';
  end if;

  select * into v from public.incidents where id = p_incident_id for update;
  if not found then
    raise exception 'Incident not found';
  end if;

  -- Who may set which status
  if v_role = 'coordinator' then
    if p_new_status not in ('under_review','verified','assigned','rejected','needs_follow_up') then
      raise exception 'Coordinators cannot set status %', p_new_status;
    end if;
    if v.organisation_id is not null and v.organisation_id <> v_org then
      raise exception 'Incident belongs to another organisation';
    end if;
  elsif v_role = 'response_team' then
    if p_new_status not in ('dispatched','completed') then
      raise exception 'Response teams cannot set status %', p_new_status;
    end if;
    if v.organisation_id is distinct from v_org then
      raise exception 'Incident is not assigned to your organisation';
    end if;
  else
    raise exception 'Role % cannot change incident status', v_role;
  end if;

  if not public.current_user_org_is_active() then
    raise exception 'Your organisation is not active';
  end if;

  if not (
    (v.status = 'reported'        and p_new_status in ('under_review','rejected'))
 or (v.status = 'under_review'    and p_new_status in ('verified','rejected','needs_follow_up'))
 or (v.status = 'verified'        and p_new_status in ('assigned','needs_follow_up'))
 or (v.status = 'assigned'        and p_new_status in ('dispatched','needs_follow_up'))
 or (v.status = 'dispatched'      and p_new_status in ('completed','needs_follow_up'))
 or (v.status = 'needs_follow_up' and p_new_status = 'under_review')
  ) then
    raise exception 'Invalid change: % to %', v.status, p_new_status;
  end if;

  update public.incidents
  set status = p_new_status,
      organisation_id = coalesce(v.organisation_id, v_org),
      verified_by = case
        when p_new_status = 'verified' then auth.uid()
        when p_new_status in ('reported','under_review','rejected') then null
        else v.verified_by end,
      verified_at = case
        when p_new_status = 'verified' then now()
        when p_new_status in ('reported','under_review','rejected') then null
        else v.verified_at end
  where id = p_incident_id;

  insert into public.incident_events (incident_id, old_status, new_status, changed_by, note)
  values (p_incident_id, v.status, p_new_status, auth.uid(), p_note);
end;
$$;

revoke all on function public.set_incident_status(uuid, public.incident_status, text)
  from public, anon;
grant execute on function public.set_incident_status(uuid, public.incident_status, text)
  to authenticated;