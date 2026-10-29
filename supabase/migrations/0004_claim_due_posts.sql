-- Atomically moves due posts scheduled → publishing. SKIP LOCKED lets concurrent ticks run
-- without ever claiming the same post twice (FR-017).
create or replace function public.claim_due_posts(batch int)
returns setof public.posts
language sql
as $$
  update public.posts
  set status = 'publishing'
  where id in (
    select id from public.posts
    where status = 'scheduled' and scheduled_at <= now()
    order by scheduled_at
    limit batch
    for update skip locked
  )
  returning *;
$$;

revoke execute on function public.claim_due_posts(int) from public, anon, authenticated;
grant execute on function public.claim_due_posts(int) to service_role;
