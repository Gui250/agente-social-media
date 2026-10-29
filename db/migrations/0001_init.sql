-- Plain Postgres (Neon). There is no RLS: every query in src/models filters by user_id itself.

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Own auth (src/lib/auth.ts): scrypt password hash, lockout after repeated failures.
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  timezone text not null default 'America/Sao_Paulo',
  failed_logins int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- id is the sha256 of the cookie token, so a leaked table can't be replayed as cookies.
create table sessions (
  id text primary key,
  user_id uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user on sessions (user_id);

create table creative_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  segment text not null check (char_length(segment) between 2 and 120),
  objective text,
  audience text,
  tone text,
  format text not null check (format in ('video', 'static')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creative_scripts_user_created on creative_scripts (user_id, created_at desc);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  history jsonb not null default '[]',
  pending_state text,
  pending_approval_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- login_type: how the account was connected (research.md › R6b). 'facebook' accounts publish
-- through graph.facebook.com with a non-expiring Page token, so token_expires_at stays null.
create table connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  provider text not null default 'instagram' check (provider = 'instagram'),
  ig_user_id text not null,
  username text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  login_type text not null default 'instagram' check (login_type in ('instagram', 'facebook')),
  fb_page_id text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ig_user_id),
  check (login_type = 'instagram' or fb_page_id is not null)
);

-- Tokens live apart from accounts and are only read in src/models/account.ts (FR-021).
create table instagram_tokens (
  account_id uuid primary key references connected_accounts (id) on delete cascade,
  access_token text not null,
  updated_at timestamptz not null default now()
);

create table media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  storage_path text not null unique,
  kind text not null check (kind in ('image', 'video')),
  mime_type text not null check (mime_type in ('image/jpeg', 'video/mp4', 'video/quicktime')),
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  account_id uuid references connected_accounts (id) on delete set null,
  script_id uuid references creative_scripts (id) on delete set null,
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
create index posts_status_scheduled on posts (status, scheduled_at);
create index posts_user on posts (user_id);

create trigger users_updated_at before update on users
  for each row execute function set_updated_at();
create trigger creative_scripts_updated_at before update on creative_scripts
  for each row execute function set_updated_at();
create trigger conversations_updated_at before update on conversations
  for each row execute function set_updated_at();
create trigger connected_accounts_updated_at before update on connected_accounts
  for each row execute function set_updated_at();
create trigger instagram_tokens_updated_at before update on instagram_tokens
  for each row execute function set_updated_at();
create trigger media_updated_at before update on media
  for each row execute function set_updated_at();
create trigger posts_updated_at before update on posts
  for each row execute function set_updated_at();

-- Atomically moves due posts scheduled → publishing. SKIP LOCKED lets concurrent ticks run
-- without ever claiming the same post twice (FR-017).
create or replace function claim_due_posts(batch int)
returns setof posts
language sql
as $$
  update posts
  set status = 'publishing'
  where id in (
    select id from posts
    where status = 'scheduled' and scheduled_at <= now()
    order by scheduled_at
    limit batch
    for update skip locked
  )
  returning *;
$$;
