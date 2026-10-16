// supabase/functions/subscribe/index.ts — the Coming Soon page's launch-notification endpoint (README "Subscribe endpoint").
// POST { email, locale: 'sq' | 'en', source } → the signup goes into public.subscribers (service role — the table has no public access); when
// RESEND_API_KEY is set, the address becomes a contact in the Resend segment "Coming soon" (properties locale + source) and receives the
// designer's confirmation email "Je lidhur — NYJA" (email-sq.html → email_sq.ts) once, from RESEND_FROM, with the unsubscribe link of the
// `unsubscribe` function (token = the row id). 2xx = registered; 409 { error: 'exists' } = the address is already on the list (the page says so —
// the owner's choice, 2026-10-16, over hiding whether an email is on the list; the repeat still completes a missing contact / confirmation);
// an unsubscribed address that signs up again is a new signup (2xx, re-subscribed); 400 = invalid address — also an address carrying one of the
// owner's blocked words (BLOCKED below; same answer, nothing to tell); 5xx = our failure (the page shows
// "Provo përsëri" / "Please try again"). Deployed with verify_jwt off: the page calls it anonymously.
// Secrets (Supabase → Edge Functions → Secrets, or Vault for the key — see resendKey()): RESEND_API_KEY (needed for Resend; without it signups are only stored), RESEND_FROM (default
// "NYJA <njoftime@nyja-ks.com>" — the domain must be verified in Resend before anything leaves), RESEND_SEGMENT_ID, UNSUBSCRIBE_URL,
// ALLOWED_ORIGINS (optional, comma-separated; default * — the endpoint is public anyway, CORS only decides which browsers may read the answer).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { EMAIL_SQ } from './email_sq.ts';

/** The page's own rule (src/config.ts EMAIL_RE). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/**
 * Words the owner will not have in an address (Blend, 2026-10-16). Matched against the address's letter-only tokens with diacritics folded
 * (ç → c, ë → e), as whole tokens — so shqipe, Karuçi, digital, Karim pass — and, for the long compounds (6+ letters), as a token's prefix,
 * so a suffix glued on (karipidhiks) does not get through. Such an address is simply "invalid" to the page.
 */
const BLOCKED = ['karipidhi', 'pidhikari', 'kari', 'pidhi', 'piqkakari', 'karipiqka', 'piqka', 'pidhnone', 'taqinonen', 'qi', 'mut', 'hamakarin', 'karuc', 'dig'];
const BLOCKED_LONG = BLOCKED.filter((w) => w.length >= 6);
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const blocked = (email: string) => fold(email).split(/[^a-z]+/).some((t) => t.length > 0 && (BLOCKED.includes(t) || BLOCKED_LONG.some((w) => t.startsWith(w))));
/** Resend segment "Coming soon" (created 2026-10-16). */
const SEGMENT_ID = Deno.env.get('RESEND_SEGMENT_ID') ?? '8d999461-daf0-4714-bd43-bdd961e97c96';
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim()).filter(Boolean);
const FROM = Deno.env.get('RESEND_FROM') ?? 'NYJA <njoftime@nyja-ks.com>';
const UNSUB_URL = Deno.env.get('UNSUBSCRIBE_URL') ?? (Deno.env.get('SUPABASE_URL') ?? '') + '/functions/v1/unsubscribe';
/** The template is Albanian only for now — every signup gets it, whatever the page's language, until an English one exists. */
const SUBJECT = 'Je lidhur — NYJA';
const RESEND = 'https://api.resend.com';

const cors = (origin: string | null): Record<string, string> => {
  const allow = ORIGINS.includes('*') ? '*' : origin && ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
};
const json = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
/** The confirmation email with the address (twice: the "REGJISTRIMI YT" card and the footer) and the unsubscribe link filled in. */
const confirmation = (email: string, unsub: string) => EMAIL_SQ.replaceAll('emri@domain.com', esc(email)).replaceAll('https://nyja-ks.com/cregjistrohu', unsub);
const resend = (key: string, path: string, method: string, body: unknown) =>
  fetch(RESEND + path, { method, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const idOf = (j: unknown): string | null => (j && typeof j === 'object' && typeof (j as { id?: unknown }).id === 'string' ? (j as { id: string }).id : null);
/** The Resend key: the Edge Function secret, else the Vault secret RESEND_API_KEY through public.resend_api_key() (security definer, service role only — migration resend_api_key_from_vault). */
async function resendKey(db: SupabaseClient): Promise<string | undefined> {
  const env = Deno.env.get('RESEND_API_KEY'); if (env) return env;
  const r = await db.rpc('resend_api_key'); if (r.error) { console.error('vault key', r.error); return undefined; }
  return typeof r.data === 'string' && r.data.length > 0 ? r.data : undefined;
}

interface Row { id: string; resend_contact_id: string | null; confirmation_sent_at: string | null; unsubscribed_at: string | null }
const COLS = 'id, resend_contact_id, confirmation_sent_at, unsubscribed_at';

Deno.serve(async (req: Request) => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' }, h);
  let body: { email?: unknown; locale?: unknown; source?: unknown };
  try { body = await req.json(); } catch { return json(400, { ok: false, error: 'json' }, h); }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL_RE.test(email) || blocked(email)) return json(400, { ok: false, error: 'email' }, h);
  const locale = body.locale === 'en' ? 'en' : 'sq';
  const source = typeof body.source === 'string' && body.source.length > 0 && body.source.length <= 64 ? body.source : 'coming-soon';

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // One row per address: a repeat signup keeps the first row (and its language). `exists` = it was already on the list and still subscribed.
  let row: Row, exists = false;
  const ins = await db.from('subscribers').insert({ email, locale, source }).select(COLS).single<Row>();
  if (!ins.error) row = ins.data;
  else if (ins.error.code === '23505') {
    const got = await db.from('subscribers').select(COLS).eq('email', email).single<Row>();
    if (got.error) { console.error('subscribers select', got.error); return json(500, { ok: false, error: 'db' }, h); }
    row = got.data; exists = !row.unsubscribed_at;
  }
  else { console.error('subscribers insert', ins.error); return json(500, { ok: false, error: 'db' }, h); }
  const unsub = UNSUB_URL + '?t=' + row.id;
  // A new signup after an unsubscribe is consent again — on our side regardless of Resend.
  if (row.unsubscribed_at) { const up = await db.from('subscribers').update({ unsubscribed_at: null }).eq('id', row.id); if (up.error) console.error('subscribers resubscribe', up.error); }

  const key = await resendKey(db);
  if (!key) console.warn('RESEND_API_KEY is set neither as a secret nor in Vault: the signup is stored, no contact and no confirmation email');
  else {
    try {
      // The contact, once; rows that arrived before the key was set get theirs on their next signup.
      if (!row.resend_contact_id) {
        const r = await resend(key, '/contacts', 'POST', { email, unsubscribed: false, segments: [{ id: SEGMENT_ID }], properties: { locale, source } });
        const cid = r.ok ? idOf(await r.json().catch(() => null)) : null;
        if (cid) { row.resend_contact_id = cid; const up = await db.from('subscribers').update({ resend_contact_id: cid }).eq('id', row.id); if (up.error) console.error('subscribers update', up.error); }
        else console.error('resend contact', r.status, await r.text().catch(() => ''));
      }
      else if (row.unsubscribed_at) {
        const r = await resend(key, '/contacts/' + row.resend_contact_id, 'PATCH', { unsubscribed: false });
        if (!r.ok) console.error('resend resubscribe', r.status, await r.text().catch(() => ''));
      }
      // The confirmation email, once (a failed attempt — no verified domain yet, a Resend outage — is retried by the address's next signup).
      if (!row.confirmation_sent_at) {
        const r = await resend(key, '/emails', 'POST', {
          from: FROM, to: [email], subject: SUBJECT, html: confirmation(email, unsub),
          headers: { 'List-Unsubscribe': '<' + unsub + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
          tags: [{ name: 'kind', value: 'confirmation' }, { name: 'locale', value: locale }],
        });
        const eid = r.ok ? idOf(await r.json().catch(() => null)) : null;
        if (r.ok) { const up = await db.from('subscribers').update({ confirmation_sent_at: new Date().toISOString(), confirmation_email_id: eid }).eq('id', row.id); if (up.error) console.error('subscribers confirmation', up.error); }
        else console.error('resend email', r.status, await r.text().catch(() => ''));
      }
    } catch (e) { console.error('resend', e); }
  }
  return exists ? json(409, { ok: false, error: 'exists' }, h) : json(200, { ok: true }, h);
});
