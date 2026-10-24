create type public.assignment_status as enum
  ('assigned', 'accepted', 'in_progress', 'completed', 'cancelled');
create type public.dispatch_status as enum
  ('preparing', 'dispatched', 'in_transit', 'delivered', 'cancelled');
create type public.receipt_status as enum
  ('confirmed', 'partially_received', 'not_received');

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id),
  organisation_id uuid not null references public.organisations (id),
  assigned_to uuid references public.profiles (id) on delete set null,
  assigned_by uuid references public.profiles (id) on delete set null,
  status public.assignment_status not null default 'assigned',
  instructions text check (instructions is null or char_length(instructions) <= 500),
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resource_dispatches (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id),
  organisation_id uuid not null references public.organisations (id),
  created_by uuid references public.profiles (id) on delete set null,
  resource_name text not null
    check (resource_name ~ '\S' and char_length(resource_name) <= 100),
  quantity integer not null check (quantity > 0 and quantity <= 1000000),
  unit text check (unit is null or char_length(unit) <= 20),
  destination text not null
    check (destination ~ '\S' and char_length(destination) <= 200),
  status public.dispatch_status not null default 'preparing',
  dispatched_by uuid references public.profiles (id) on delete set null,
  dispatched_at timestamptz,
  delivered_by uuid references public.profiles (id) on delete set null,
  delivered_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.receipt_confirmations (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  dispatch_id uuid not null references public.resource_dispatches (id),
  confirmed_by uuid references public.profiles (id) on delete set null,
  status public.receipt_status not null,
  quantity_received integer check (quantity_received is null or quantity_received >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index assignments_incident_idx on public.assignments (incident_id, status);
create index assignments_org_idx on public.assignments (organisation_id, status);
create index assignments_assignee_idx on public.assignments (assigned_to);
create index dispatches_incident_idx on public.resource_dispatches (incident_id, status);
create index dispatches_org_idx on public.resource_dispatches (organisation_id, status);
create index receipts_dispatch_idx on public.receipt_confirmations (dispatch_id, seq);

create unique index assignments_one_active_per_person
  on public.assignments (incident_id, assigned_to)
  where assigned_to is not null
    and status in ('assigned', 'accepted', 'in_progress');

create trigger assignments_no_delete before delete on public.assignments
  for each row execute function public.block_delete();
create trigger dispatches_no_delete before delete on public.resource_dispatches
  for each row execute function public.block_delete();
create trigger receipts_no_delete before delete on public.receipt_confirmations
  for each row execute function public.block_delete();
create trigger receipts_no_update before update on public.receipt_confirmations
  for each row execute function public.block_update();
create trigger assignments_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();
create trigger dispatches_updated_at before update on public.resource_dispatches
  for each row execute function public.set_updated_at();

alter table public.assignments enable row level security;
alter table public.resource_dispatches enable row level security;
alter table public.receipt_confirmations enable row level security;

revoke all on public.assignments, public.resource_dispatches,
  public.receipt_confirmations from anon, authenticated;
grant select on public.assignments, public.resource_dispatches,
  public.receipt_confirmations to authenticated;

create policy "Staff read own organisation assignments"
  on public.assignments for select
  using (public.current_user_role() <> 'resident'
         and organisation_id = public.current_user_org()
         and public.current_user_org_is_active());

create policy "Staff read own organisation dispatches"
  on public.resource_dispatches for select
  using (public.current_user_role() <> 'resident'
         and organisation_id = public.current_user_org()
         and public.current_user_org_is_active());

create policy "Read receipts of visible dispatches"
  on public.receipt_confirmations for select
  using (exists (
    select 1 from public.resource_dispatches d where d.id = dispatch_id
  ));

create or replace function public.set_incident_status(
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

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note must be 500 characters or fewer';
  end if;

  select * into v from public.incidents where id = p_incident_id for update;
  if not found then
    raise exception 'Incident not found';
  end if;

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

  if p_new_status = 'completed' and exists (
    select 1 from public.resource_dispatches d
    where d.incident_id = p_incident_id
      and d.status in ('preparing', 'dispatched', 'in_transit')
  ) then
    raise exception 'Incident has open dispatches. Deliver or cancel them first';
  end if;

  if p_new_status = 'completed' and exists (
    select 1 from public.assignments a
    where a.incident_id = p_incident_id
      and a.status in ('assigned', 'accepted', 'in_progress')
  ) then
    raise exception 'Incident has active assignments. Complete or cancel them first';
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

create function public.create_assignment(
  p_incident_id uuid,
  p_assigned_to uuid,
  p_instructions text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_org();
  v_inc public.incidents%rowtype;
  v_id uuid;
begin
  if v_role is null then raise exception 'Not signed in'; end if;
  if v_role <> 'coordinator' then
    raise exception 'Only coordinators can assign responders';
  end if;
  if not public.current_user_org_is_active() then
    raise exception 'Your organisation is not active';
  end if;
  if p_instructions is not null and char_length(p_instructions) > 500 then
    raise exception 'Instructions must be 500 characters or fewer';
  end if;

  select * into v_inc from public.incidents where id = p_incident_id for update;
  if not found then raise exception 'Incident not found'; end if;
  if v_inc.organisation_id is distinct from v_org then
    raise exception 'Incident is not in your organisation';
  end if;
  if v_inc.status not in ('verified', 'assigned') then
    raise exception 'Incident must be verified before it can be assigned';
  end if;

  if p_assigned_to is null then
    raise exception 'An assignee is required';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_assigned_to and role = 'response_team' and organisation_id = v_org
  ) then
    raise exception 'Assignee must be a response team member of your organisation';
  end if;
  if exists (
    select 1 from public.assignments
    where incident_id = p_incident_id and assigned_to = p_assigned_to
      and status in ('assigned', 'accepted', 'in_progress')
  ) then
    raise exception 'This responder already has an active assignment on this incident';
  end if;

  insert into public.assignments (incident_id, organisation_id, assigned_to, assigned_by, instructions)
  values (p_incident_id, v_org, p_assigned_to, auth.uid(), p_instructions)
  returning id into v_id;

  if v_inc.status = 'verified' then
    perform public.set_incident_status(p_incident_id, 'assigned', 'Response team assigned');
  end if;
  return v_id;
end;
$$;

create function public.update_assignment_status(
  p_assignment_id uuid,
  p_new_status public.assignment_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_org();
  v_a public.assignments%rowtype;
begin
  if v_role is null then raise exception 'Not signed in'; end if;
  if not public.current_user_org_is_active() then
    raise exception 'Your organisation is not active';
  end if;

  select * into v_a from public.assignments where id = p_assignment_id for update;
  if not found then raise exception 'Assignment not found'; end if;
  if v_a.organisation_id is distinct from v_org then
    raise exception 'Assignment is not in your organisation';
  end if;

  if v_role = 'response_team' then
    if p_new_status not in ('accepted', 'in_progress', 'completed') then
      raise exception 'Response teams cannot set status %', p_new_status;
    end if;
    if v_a.assigned_to is not null and v_a.assigned_to <> auth.uid() then
      raise exception 'This assignment belongs to another team member';
    end if;
  elsif v_role = 'coordinator' then
    if p_new_status <> 'cancelled' then
      raise exception 'Coordinators can only cancel assignments';
    end if;
  else
    raise exception 'Role % cannot change assignments', v_role;
  end if;

  if not (
    (v_a.status = 'assigned'    and p_new_status in ('accepted', 'cancelled'))
 or (v_a.status = 'accepted'    and p_new_status in ('in_progress', 'cancelled'))
 or (v_a.status = 'in_progress' and p_new_status in ('completed', 'cancelled'))
  ) then
    raise exception 'Invalid change: % to %', v_a.status, p_new_status;
  end if;

  update public.assignments
  set status = p_new_status,
      accepted_at = case when p_new_status = 'accepted' then now() else accepted_at end,
      completed_at = case when p_new_status = 'completed' then now() else completed_at end
  where id = p_assignment_id;
end;
$$;

create function public.create_dispatch(
  p_incident_id uuid,
  p_resource_name text,
  p_quantity integer,
  p_destination text,
  p_unit text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_org();
  v_inc public.incidents%rowtype;
  v_id uuid;
begin
  if v_role is null then raise exception 'Not signed in'; end if;
  if v_role <> 'coordinator' then
    raise exception 'Only coordinators can create dispatches';
  end if;
  if not public.current_user_org_is_active() then
    raise exception 'Your organisation is not active';
  end if;

  if coalesce(p_resource_name, '') !~ '\S' or char_length(p_resource_name) > 100 then
    raise exception 'Resource name is required (up to 100 characters)';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then
    raise exception 'Quantity must be between 1 and 1000000';
  end if;
  if coalesce(p_destination, '') !~ '\S' or char_length(p_destination) > 200 then
    raise exception 'Destination is required (up to 200 characters)';
  end if;
  if p_unit is not null and char_length(p_unit) > 20 then
    raise exception 'Unit must be 20 characters or fewer';
  end if;
  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception 'Notes must be 500 characters or fewer';
  end if;

  select * into v_inc from public.incidents where id = p_incident_id for update;
  if not found then raise exception 'Incident not found'; end if;
  if v_inc.organisation_id is distinct from v_org then
    raise exception 'Incident is not in your organisation';
  end if;
  if v_inc.status not in ('assigned', 'dispatched') then
    raise exception 'Incident must be assigned before resources are dispatched';
  end if;

  insert into public.resource_dispatches
    (incident_id, organisation_id, created_by, resource_name, quantity, unit, destination, notes)
  values
    (p_incident_id, v_org, auth.uid(), p_resource_name, p_quantity, p_unit, p_destination, p_notes)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.update_dispatch_status(
  p_dispatch_id uuid,
  p_new_status public.dispatch_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_org();
  v_d public.resource_dispatches%rowtype;
begin
  if v_role is null then raise exception 'Not signed in'; end if;
  if not public.current_user_org_is_active() then
    raise exception 'Your organisation is not active';
  end if;

  select * into v_d from public.resource_dispatches where id = p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if v_d.organisation_id is distinct from v_org then
    raise exception 'Dispatch is not in your organisation';
  end if;

  if v_role = 'response_team' then
    if p_new_status not in ('dispatched', 'in_transit', 'delivered') then
      raise exception 'Response teams cannot set status %', p_new_status;
    end if;
  elsif v_role = 'coordinator' then
    if p_new_status <> 'cancelled' then
      raise exception 'Coordinators can only cancel dispatches';
    end if;
  else
    raise exception 'Role % cannot change dispatches', v_role;
  end if;

  if not (
    (v_d.status = 'preparing'  and p_new_status in ('dispatched', 'cancelled'))
 or (v_d.status = 'dispatched' and p_new_status in ('in_transit', 'delivered', 'cancelled'))
 or (v_d.status = 'in_transit' and p_new_status in ('delivered', 'cancelled'))
  ) then
    raise exception 'Invalid change: % to %', v_d.status, p_new_status;
  end if;

  update public.resource_dispatches
  set status = p_new_status,
      dispatched_by = case when p_new_status = 'dispatched' then auth.uid() else dispatched_by end,
      dispatched_at = case when p_new_status = 'dispatched' then now() else dispatched_at end,
      delivered_by = case when p_new_status = 'delivered' then auth.uid() else delivered_by end,
      delivered_at = case when p_new_status = 'delivered' then now() else delivered_at end
  where id = p_dispatch_id;

  if p_new_status = 'dispatched'
     and (select status from public.incidents where id = v_d.incident_id) = 'assigned' then
    perform public.set_incident_status(v_d.incident_id, 'dispatched', 'First dispatch sent');
  end if;
end;
$$;

create function public.confirm_receipt(
  p_dispatch_id uuid,
  p_status public.receipt_status,
  p_quantity_received integer default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_org();
  v_d public.resource_dispatches%rowtype;
begin
  if v_role is null then raise exception 'Not signed in'; end if;
  if v_role <> 'response_team' then
    raise exception 'Only response team members can confirm receipt';
  end if;
  if not public.current_user_org_is_active() then
    raise exception 'Your organisation is not active';
  end if;
  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception 'Notes must be 500 characters or fewer';
  end if;

  select * into v_d from public.resource_dispatches where id = p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if v_d.organisation_id is distinct from v_org then
    raise exception 'Dispatch is not in your organisation';
  end if;
  if v_d.status <> 'delivered' then
    raise exception 'Only delivered dispatches can be confirmed';
  end if;

  if auth.uid() = v_d.created_by
     or auth.uid() = v_d.dispatched_by
     or auth.uid() = v_d.delivered_by then
    raise exception 'You cannot confirm a delivery you handled yourself';
  end if;

  if p_quantity_received is not null and p_quantity_received > v_d.quantity then
    raise exception 'Received quantity cannot exceed the quantity sent (%)', v_d.quantity;
  end if;
  if p_status = 'confirmed'
     and p_quantity_received is not null and p_quantity_received <> v_d.quantity then
    raise exception 'A confirmed delivery must match the quantity sent. Use partially_received for a shortfall';
  end if;
  if p_status = 'partially_received'
     and (p_quantity_received is null or p_quantity_received >= v_d.quantity) then
    raise exception 'Partially received needs a quantity below the quantity sent (%)', v_d.quantity;
  end if;
  if p_status = 'not_received' and coalesce(p_quantity_received, 0) <> 0 then
    raise exception 'Not received means the quantity is zero or empty';
  end if;

  insert into public.receipt_confirmations
    (dispatch_id, confirmed_by, status, quantity_received, notes)
  values
    (p_dispatch_id, auth.uid(), p_status, p_quantity_received, p_notes);
end;
$$;

revoke all on function public.create_assignment(uuid, uuid, text) from public, anon;
revoke all on function public.update_assignment_status(uuid, public.assignment_status) from public, anon;
revoke all on function public.create_dispatch(uuid, text, integer, text, text, text) from public, anon;
revoke all on function public.update_dispatch_status(uuid, public.dispatch_status) from public, anon;
revoke all on function public.confirm_receipt(uuid, public.receipt_status, integer, text) from public, anon;

grant execute on function public.create_assignment(uuid, uuid, text) to authenticated;
grant execute on function public.update_assignment_status(uuid, public.assignment_status) to authenticated;
grant execute on function public.create_dispatch(uuid, text, integer, text, text, text) to authenticated;
grant execute on function public.update_dispatch_status(uuid, public.dispatch_status) to authenticated;
grant execute on function public.confirm_receipt(uuid, public.receipt_status, integer, text) to authenticated;

create view public.dispatch_discrepancies
with (security_invoker = true) as
select d.id as dispatch_id,
       d.incident_id,
       d.organisation_id,
       d.resource_name,
       d.quantity as quantity_sent,
       c.quantity_received,
       c.status as receipt_status,
       case
         when c.id is null then 'delivered_not_confirmed'
         when c.status = 'not_received' then 'not_received'
         else 'quantity_mismatch'
       end as issue
from public.resource_dispatches d
left join lateral (
  select rc.id, rc.status, rc.quantity_received
  from public.receipt_confirmations rc
  where rc.dispatch_id = d.id
  order by rc.seq desc
  limit 1
) c on true
where d.status = 'delivered'
  and (c.id is null
       or c.status <> 'confirmed'
       or coalesce(c.quantity_received, d.quantity) <> d.quantity);

revoke all on public.dispatch_discrepancies from anon, authenticated;
grant select on public.dispatch_discrepancies to authenticated;