-- Skills a user imported (a SKILL.md upload), on top of the ones in skills/ (src/agent/skills.ts).
-- Importing the same name again replaces it.
create table user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  description text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create trigger user_skills_updated_at before update on user_skills
  for each row execute function set_updated_at();
