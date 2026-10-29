create table public.creative_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  segment text not null check (char_length(segment) between 2 and 120),
  objective text,
  audience text,
  tone text,
  format text not null check (format in ('video', 'static')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creative_scripts_user_created on public.creative_scripts (user_id, created_at desc);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  history jsonb not null default '[]',
  pending_state text,
  pending_approval_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creative_scripts enable row level security;
alter table public.conversations enable row level security;

create policy "creative_scripts: own rows" on public.creative_scripts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "conversations: own rows" on public.conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger creative_scripts_updated_at before update on public.creative_scripts
  for each row execute function public.set_updated_at();
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();
