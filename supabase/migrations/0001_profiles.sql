create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles: own select" on public.profiles for select using (id = auth.uid());
create policy "profiles: own update" on public.profiles for update using (id = auth.uid());

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile on sign-up, taking the browser timezone when it is a real IANA name.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tz text := new.raw_user_meta_data ->> 'timezone';
begin
  if tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then
    tz := 'America/Sao_Paulo';
  end if;
  insert into public.profiles (id, timezone) values (new.id, tz);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
