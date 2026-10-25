alter table public.resource_dispatches
  add column origin text check (origin is null or char_length(origin) <= 200);

create type public.stock_reason as enum
  ('stock_in', 'dispatch', 'dispatch_cancelled', 'dispatch_returned');

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id),
  resource_name text not null
    check (resource_name ~ '\S' and resource_name = btrim(resource_name) and char_length(resource_name) <= 100),
  unit text check (unit is null or (unit = btrim(unit) and unit ~ '\S' and char_length(unit) <= 20)),
  quantity_change integer not null check (quantity_change <> 0),
  reason public.stock_reason not null,
  dispatch_id uuid references public.resource_dispatches (id),
  created_by uuid references public.profiles (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  check ((reason = 'dispatch' and quantity_change < 0)
         or (reason <> 'dispatch' and quantity_change > 0)),
  check ((reason = 'stock_in') = (dispatch_id is null))
);

create index stock_movements_lookup_idx
  on public.stock_movements (organisation_id, (lower(resource_name)), (lower(coalesce(unit, ''))));
create index stock_movements_dispatch_idx on public.stock_movements (dispatch_id);

create trigger stock_movements_no_delete before delete on public.stock_movements
  for each row execute function public.block_delete();
create trigger stock_movements_no_update before update on public.stock_movements
  for each row execute function public.block_update();

alter table public.stock_movements enable row level security;
revoke all on public.stock_movements from anon, authenticated;
grant select on public.stock_movements to authenticated;

create policy "Stock managers read own organisation stock movements"
  on public.stock_movements for select
  using (public.current_user_role() in ('coordinator', 'finance', 'auditor', 'admin')
         and organisation_id = public.current_user_org()
         and public.current_user_org_is_active());

create view public.resource_stock_levels
with (security_invoker = true) as
select organisation_id,
       min(resource_name) as resource_name,
       min(unit) as unit,
       sum(quantity_change)::bigint as quantity_on_hand
from public.stock_movements
group by organisation_id, lower(resource_name), lower(coalesce(unit, ''));

revoke all on public.resource_stock_levels from anon, authenticated;
grant select on public.resource_stock_levels to authenticated;

create function public.record_stock_in(
  p_resource_name text,
  p_quantity integer,
  p_unit text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_org();
  v_name text := btrim(p_resource_name);
  v_unit text := nullif(btrim(p_unit), '');
  v_id uuid;
begin
  if v_role is null then raise exception 'Not signed in'; end if;
  if v_role not in ('coordinator', 'finance') then
    raise exception 'Only coordinators and finance staff can record stock';
  end if;
  if not public.current_user_org_is_active() then
    raise exception 'Your organisation is not active';
  end if;
  if coalesce(v_name, '') = '' or char_length(v_name) > 100 then
    raise exception 'Resource name is required (up to 100 characters)';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then
    raise exception 'Quantity must be between 1 and 1000000';
  end if;
  if v_unit is not null and char_length(v_unit) > 20 then
    raise exception 'Unit must be 20 characters or fewer';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note must be 500 characters or fewer';
  end if;

  insert into public.stock_movements
    (organisation_id, resource_name, unit, quantity_change, reason, created_by, note)
  values (v_org, v_name, v_unit, p_quantity, 'stock_in', auth.uid(), p_note)
  returning id into v_id;
  return v_id;
end;
$$;

drop function if exists public.create_dispatch(uuid, text, integer, text, text, text);

create function public.create_dispatch(
  p_incident_id uuid,
  p_resource_name text,
  p_quantity integer,
  p_destination text,
  p_unit text default null,
  p_notes text default null,
  p_origin text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_org();
  v_name text := btrim(p_resource_name);
  v_unit text := nullif(btrim(p_unit), '');
  v_origin text := nullif(btrim(p_origin), '');
  v_inc public.incidents%rowtype;
  v_available bigint;
  v_id uuid;
begin
  if v_role is null then raise exception 'Not signed in'; end if;
  if v_role <> 'coordinator' then
    raise exception 'Only coordinators can create dispatches';
  end if;
  if not public.current_user_org_is_active() then
    raise exception 'Your organisation is not active';
  end if;

  if coalesce(v_name, '') = '' or char_length(v_name) > 100 then
    raise exception 'Resource name is required (up to 100 characters)';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then
    raise exception 'Quantity must be between 1 and 1000000';
  end if;
  if coalesce(p_destination, '') !~ '\S' or char_length(p_destination) > 200 then
    raise exception 'Destination is required (up to 200 characters)';
  end if;
  if v_unit is not null and char_length(v_unit) > 20 then
    raise exception 'Unit must be 20 characters or fewer';
  end if;
  if v_origin is not null and char_length(v_origin) > 200 then
    raise exception 'Origin must be 200 characters or fewer';
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

  perform pg_advisory_xact_lock(
    hashtextextended(v_org::text || '|' || lower(v_name) || '|' || lower(coalesce(v_unit, '')), 0));

  select coalesce(sum(quantity_change), 0) into v_available
  from public.stock_movements
  where organisation_id = v_org
    and lower(resource_name) = lower(v_name)
    and lower(coalesce(unit, '')) = lower(coalesce(v_unit, ''));

  if v_available < p_quantity then
    raise exception 'Not enough stock: % available, % requested', v_available, p_quantity;
  end if;

  insert into public.resource_dispatches
    (incident_id, organisation_id, created_by, resource_name, quantity, unit, destination, origin, notes)
  values
    (p_incident_id, v_org, auth.uid(), v_name, p_quantity, v_unit, p_destination, v_origin, p_notes)
  returning id into v_id;

  insert into public.stock_movements
    (organisation_id, resource_name, unit, quantity_change, reason, dispatch_id, created_by)
  values (v_org, v_name, v_unit, -p_quantity, 'dispatch', v_id, auth.uid());

  return v_id;
end;
$$;

create or replace function public.update_dispatch_status(
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

  -- stock returns automatically only if nothing has left yet
  if p_new_status = 'cancelled' and v_d.status = 'preparing' then
    insert into public.stock_movements
      (organisation_id, resource_name, unit, quantity_change, reason, dispatch_id, created_by, note)
    values (v_d.organisation_id, v_d.resource_name, v_d.unit, v_d.quantity,
            'dispatch_cancelled', v_d.id, auth.uid(), 'Cancelled before leaving');
  end if;

  if p_new_status = 'dispatched'
     and (select status from public.incidents where id = v_d.incident_id) = 'assigned' then
    perform public.set_incident_status(v_d.incident_id, 'dispatched', 'First dispatch sent');
  end if;
end;
$$;

create function public.record_stock_return(
  p_dispatch_id uuid,
  p_quantity integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_org();
  v_d public.resource_dispatches%rowtype;
  v_returned bigint;
  v_id uuid;
begin
  if v_role is null then raise exception 'Not signed in'; end if;
  if v_role not in ('coordinator', 'finance') then
    raise exception 'Only coordinators and finance staff can record returned stock';
  end if;
  if not public.current_user_org_is_active() then
    raise exception 'Your organisation is not active';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Note must be 500 characters or fewer';
  end if;

  select * into v_d from public.resource_dispatches where id = p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if v_d.organisation_id is distinct from v_org then
    raise exception 'Dispatch is not in your organisation';
  end if;
  if v_d.status <> 'cancelled' or v_d.dispatched_at is null then
    raise exception 'Returns can only be recorded for a dispatch cancelled after it left';
  end if;

  select coalesce(sum(quantity_change), 0) into v_returned
  from public.stock_movements
  where dispatch_id = p_dispatch_id and reason = 'dispatch_returned';

  if v_returned + p_quantity > v_d.quantity then
    raise exception 'Cannot return more than was sent (% sent, % already returned)',
      v_d.quantity, v_returned;
  end if;

  insert into public.stock_movements
    (organisation_id, resource_name, unit, quantity_change, reason, dispatch_id, created_by, note)
  values (v_d.organisation_id, v_d.resource_name, v_d.unit, p_quantity,
          'dispatch_returned', v_d.id, auth.uid(), p_note)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_stock_in(text, integer, text, text) from public, anon;
revoke all on function public.create_dispatch(uuid, text, integer, text, text, text, text) from public, anon;
revoke all on function public.record_stock_return(uuid, integer, text) from public, anon;
grant execute on function public.record_stock_in(text, integer, text, text) to authenticated;
grant execute on function public.create_dispatch(uuid, text, integer, text, text, text, text) to authenticated;
grant execute on function public.record_stock_return(uuid, integer, text) to authenticated;

create view public.incident_status_counts
with (security_invoker = true) as
select status, count(*)::integer as total
from public.incidents
group by status;

create view public.dispatch_status_counts
with (security_invoker = true) as
select status, count(*)::integer as total
from public.resource_dispatches
group by status;

revoke all on public.incident_status_counts, public.dispatch_status_counts from anon, authenticated;
grant select on public.incident_status_counts, public.dispatch_status_counts to authenticated;