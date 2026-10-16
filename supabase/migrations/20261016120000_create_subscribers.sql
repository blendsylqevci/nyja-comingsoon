-- Launch-notification signups from the Coming Soon page (nyja-comingsoon). Written only by the `subscribe` Edge Function
-- (service role); RLS is on with no policies, so the anon / authenticated roles can neither read nor write.
-- Applied to project kgbuquggwvnclqnyvbsl ("Nyja Coming Soon") on 2026-10-16 as migration `create_subscribers`.
create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  locale text not null default 'sq' check (locale in ('sq', 'en')),
  source text not null default 'coming-soon',
  resend_contact_id text,
  created_at timestamptz not null default now(),
  constraint subscribers_email_lower check (email = lower(email)),
  constraint subscribers_email_unique unique (email)
);
comment on table public.subscribers is 'Coming Soon launch-notification signups (email, UI language, source). Written by the subscribe Edge Function only.';
comment on column public.subscribers.locale is 'UI language of the page at signup: sq or en — the launch email goes out in it.';
comment on column public.subscribers.resend_contact_id is 'The Resend contact created for this signup (null if Resend was not configured at the time).';
alter table public.subscribers enable row level security;
revoke all on public.subscribers from anon, authenticated;
