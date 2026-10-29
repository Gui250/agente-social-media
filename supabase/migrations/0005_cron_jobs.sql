create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Calls an app cron route with the shared secret. Both values come from Supabase Vault, created
-- per environment (see specs/001-social-media-agent/quickstart.md › Produção). Without them the
-- job is a no-op, which is the case for local development.
create or replace function public.call_app_cron(path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  secret text;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if app_url is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(app_url, '/') || path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.call_app_cron(text) from public, anon, authenticated;

select cron.schedule('publish-due-posts', '* * * * *', $$select public.call_app_cron('/api/cron/publish')$$);
select cron.schedule('refresh-instagram-tokens', '0 3 * * *', $$select public.call_app_cron('/api/cron/refresh-tokens')$$);
