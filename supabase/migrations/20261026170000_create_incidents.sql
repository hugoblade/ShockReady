create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  title varchar(150) not null,
  description varchar(2000) not null,
  category varchar(40) not null,
  severity varchar(20) not null default 'medium',
  priority varchar(20) not null default 'medium',
  province varchar(100) not null,
  district varchar(100) not null,
  location_details varchar(300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  submission_method varchar(20) not null default 'WEB',
  status varchar(20) not null default 'reported'
    check (status in ('reported', 'verified', 'in_progress', 'resolved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.incidents
  add column if not exists reporter_id uuid references auth.users (id) on delete set null,
  add column if not exists title varchar(150) not null default 'Incident report',
  add column if not exists description varchar(2000) not null default '',
  add column if not exists category varchar(40) not null default 'OTHER',
  add column if not exists severity varchar(20) not null default 'medium',
  add column if not exists priority varchar(20) not null default 'medium',
  add column if not exists province varchar(100) not null default 'Unknown',
  add column if not exists district varchar(100) not null default 'Unknown',
  add column if not exists location_details varchar(300),
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists submission_method varchar(20) not null default 'WEB',
  add column if not exists status varchar(20) not null default 'reported',
  add column if not exists created_at timestamptz not null default now();

alter table public.incidents
  alter column title drop default,
  alter column description drop default,
  alter column category drop default,
  alter column province drop default,
  alter column district drop default;

create index if not exists incidents_reporter_created_at_idx
  on public.incidents (reporter_id, created_at desc);

create index if not exists incidents_public_map_idx
  on public.incidents (created_at desc)
  where status = 'verified';

alter table public.incidents enable row level security;
