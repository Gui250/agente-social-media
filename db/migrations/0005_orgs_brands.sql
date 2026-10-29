-- Companies, their brands and brand kits (specs/002-orgs-brands). A company has a single owner
-- (organizations.user_id); brands and brand files are authorized by joining up to it, so every
-- query in src/models filters by the owner through organizations.user_id.

create table organizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  -- Generated from the name on create and never changed, so links keep working after a rename.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 65),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index organizations_user_created on organizations (user_id, created_at desc);
create trigger organizations_updated_at before update on organizations
  for each row execute function set_updated_at();

-- The brand kit lives on the brand: it is always read and saved whole.
create table brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 1000),
  industry text check (char_length(industry) <= 120),
  target_audience text check (char_length(target_audience) <= 500),
  brand_voice text check (char_length(brand_voice) <= 500),
  color_palette jsonb not null default '[]',
  typography jsonb not null default '[]',
  visual_guidelines text[] not null default '{}',
  forbidden_elements text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brands_org_name on brands (organization_id, lower(name));
create trigger brands_updated_at before update on brands
  for each row execute function set_updated_at();

-- Files in the private Blob store under "<userId>/brands/<brandId>/". One active logo per brand.
create table brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  asset_type text not null check (asset_type in ('logo', 'logo_alt', 'other')),
  storage_key text not null unique,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  width int not null check (width between 64 and 8000),
  height int not null check (height between 64 and 8000),
  size_bytes int not null check (size_bytes <= 10485760),
  created_at timestamptz not null default now()
);
create unique index brand_assets_one_logo on brand_assets (brand_id) where asset_type = 'logo';
create index brand_assets_brand on brand_assets (brand_id);

-- Who did what. No FK to the entity, so entries outlive what they describe.
create table audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references users (id) on delete cascade,
  action text not null,
  entity_type text not null check (entity_type in ('organization', 'brand', 'brand_asset')),
  entity_id uuid not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_user_created on audit_log (user_id, created_at desc);
