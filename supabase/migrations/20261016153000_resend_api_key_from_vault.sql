-- The Resend key can live in Vault (encrypted at rest) instead of the Edge Function secrets: the subscribe / unsubscribe functions call this
-- RPC with the service role when the RESEND_API_KEY environment variable is absent. Security definer, owned by postgres, so it may read the
-- decrypted view; nothing but the service role may execute it. Store the key with:
--   select vault.create_secret('<key>', 'RESEND_API_KEY', 'Resend full-access key for the subscribe / unsubscribe Edge Functions');
-- Applied to project kgbuquggwvnclqnyvbsl on 2026-10-16 as migration `resend_api_key_from_vault`.
create or replace function public.resend_api_key() returns text
language sql security definer set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'RESEND_API_KEY' order by created_at desc limit 1 $$;
comment on function public.resend_api_key() is 'The Resend API key from Vault (secret name RESEND_API_KEY) for the Edge Functions; service role only.';
revoke all on function public.resend_api_key() from public, anon, authenticated;
grant execute on function public.resend_api_key() to service_role;
