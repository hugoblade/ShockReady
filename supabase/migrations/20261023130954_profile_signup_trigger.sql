-- Migration: Signup automation with enforced consent and validation

-- 1. Add consent tracking and versioning to the profiles table
alter table public.profiles 
add column consent_given_at timestamptz not null,
add column consent_version text;

-- 2. Create the secure trigger function
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submitted_full_name text;
  consent_given text;
begin
  consent_given := lower(
    btrim(coalesce(new.raw_user_meta_data ->> 'consent_given', ''))
  );

  if consent_given <> 'true' then
    raise exception 'Consent is required to create an account';
  end if;

  submitted_full_name := nullif(
    btrim(new.raw_user_meta_data ->> 'full_name'),
    ''
  );

  if submitted_full_name is not null
     and char_length(submitted_full_name) > 200 then
    raise exception 'Full name must be 200 characters or fewer';
  end if;

  insert into public.profiles (
    id,
    full_name,
    role,
    consent_given_at,
    consent_version
  )
  values (
    new.id,
    submitted_full_name,
    'resident'::public.user_role,
    now(),
    'privacy-notice-v1'
  );

  return new;
end;
$$;

-- 3. Lockdown: Only the trigger can run this function
revoke all on function public.handle_new_user()
  from public, anon, authenticated;

-- 4. Attach the trigger to Supabase's internal auth.users table
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();