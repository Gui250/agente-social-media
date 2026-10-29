create table public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'instagram' check (provider = 'instagram'),
  ig_user_id text not null,
  username text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ig_user_id)
);

-- Tokens live apart from accounts: RLS on with NO policies, so only the service role can read them.
create table public.instagram_tokens (
  account_id uuid primary key references public.connected_accounts (id) on delete cascade,
  access_token text not null,
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  kind text not null check (kind in ('image', 'video')),
  mime_type text not null check (mime_type in ('image/jpeg', 'video/mp4', 'video/quicktime')),
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid references public.connected_accounts (id) on delete set null,
  script_id uuid references public.creative_scripts (id) on delete set null,
  post_type text not null check (post_type in ('image', 'carousel', 'reel')),
  caption text not null check (char_length(caption) <= 2200),
  media_ids uuid[] not null,
  scheduled_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  ig_container_id text,
  ig_media_id text,
  permalink text,
  failure_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_at is not null)
);
create index posts_status_scheduled on public.posts (status, scheduled_at);

alter table public.connected_accounts enable row level security;
alter table public.instagram_tokens enable row level security;
alter table public.media enable row level security;
alter table public.posts enable row level security;

-- Accounts are written by the server (OAuth callback) with the service role; users only read.
create policy "connected_accounts: own select" on public.connected_accounts
  for select using (user_id = auth.uid());
create policy "media: own rows" on public.media
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "posts: own rows" on public.posts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger connected_accounts_updated_at before update on public.connected_accounts
  for each row execute function public.set_updated_at();
create trigger instagram_tokens_updated_at before update on public.instagram_tokens
  for each row execute function public.set_updated_at();
create trigger media_updated_at before update on public.media
  for each row execute function public.set_updated_at();
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- Private bucket; files are uploaded straight from the browser under "<uid>/...".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 104857600, array['image/jpeg', 'video/mp4', 'video/quicktime']);

create policy "post-media: own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "post-media: own folder select" on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "post-media: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
