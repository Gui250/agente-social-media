-- How the account was connected (research.md › R6b). 'facebook' accounts publish through
-- graph.facebook.com with a non-expiring Page token, so token_expires_at stays null for them.
alter table public.connected_accounts
  add column login_type text not null default 'instagram' check (login_type in ('instagram', 'facebook')),
  add column fb_page_id text,
  add check (login_type = 'instagram' or fb_page_id is not null);
