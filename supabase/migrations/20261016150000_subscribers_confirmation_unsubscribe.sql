-- The confirmation email (sent once per address through Resend) and the "Çregjistrohu" link of that email.
-- Applied to project kgbuquggwvnclqnyvbsl on 2026-10-16 as migration `subscribers_confirmation_unsubscribe`.
alter table public.subscribers
  add column confirmation_sent_at timestamptz,
  add column confirmation_email_id text,
  add column unsubscribed_at timestamptz;
comment on column public.subscribers.confirmation_sent_at is 'When the confirmation email was accepted by Resend (null = not yet: no key, domain not verified, or a failure — the next signup of the address retries).';
comment on column public.subscribers.confirmation_email_id is 'Resend id of the confirmation email.';
comment on column public.subscribers.unsubscribed_at is 'Set by the unsubscribe Edge Function (the email''s Çregjistrohu link, token = the row id); cleared by a new signup of the same address.';
