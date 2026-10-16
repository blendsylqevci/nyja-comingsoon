// supabase/functions/subscribe/index.ts — the Coming Soon page's launch-notification endpoint (README "Subscribe endpoint").
// POST { email, locale: 'sq' | 'en', source } → the signup goes into public.subscribers (service role — the table has no public access) and,
// when RESEND_API_KEY is set, the address becomes a contact in the Resend segment "Coming soon" with the properties locale + source.
// 2xx = registered (an address that was already there is a 2xx too: nothing reveals whether an email is on the list); 400 = invalid
// address; 5xx = our failure (the page shows "Provo përsëri" / "Please try again"). Deployed with verify_jwt off: the page calls it anonymously.
// Secrets (Supabase → Edge Functions → Secrets): RESEND_API_KEY (needed for Resend; without it signups are only stored), RESEND_SEGMENT_ID
// (optional override), ALLOWED_ORIGINS (optional, comma-separated; default * — the endpoint is public anyway, CORS only decides which browsers may read the answer).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** The page's own rule (src/config.ts EMAIL_RE). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Resend segment "Coming soon" (created 2026-10-16). */
const SEGMENT_ID = Deno.env.get('RESEND_SEGMENT_ID') ?? '8d999461-daf0-4714-bd43-bdd961e97c96';
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim()).filter(Boolean);

const cors = (origin: string | null): Record<string, string> => {
  const allow = ORIGINS.includes('*') ? '*' : origin && ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
};
const json = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' }, h);
  let body: { email?: unknown; locale?: unknown; source?: unknown };
  try { body = await req.json(); } catch { return json(400, { ok: false, error: 'json' }, h); }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL_RE.test(email)) return json(400, { ok: false, error: 'email' }, h);
  const locale = body.locale === 'en' ? 'en' : 'sq';
  const source = typeof body.source === 'string' && body.source.length > 0 && body.source.length <= 64 ? body.source : 'coming-soon';

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // One row per address: a repeat signup keeps the first row (and its language) and only completes a missing Resend contact.
  let id: string, contactId: string | null;
  const ins = await db.from('subscribers').insert({ email, locale, source }).select('id, resend_contact_id').single();
  if (!ins.error) { id = ins.data.id; contactId = ins.data.resend_contact_id; }
  else if (ins.error.code === '23505') {
    const got = await db.from('subscribers').select('id, resend_contact_id').eq('email', email).single();
    if (got.error) { console.error('subscribers select', got.error); return json(500, { ok: false, error: 'db' }, h); }
    id = got.data.id; contactId = got.data.resend_contact_id;
  }
  else { console.error('subscribers insert', ins.error); return json(500, { ok: false, error: 'db' }, h); }

  // Resend: the contact, once. Rows that arrived before the key was set get their contact on their next signup.
  const key = Deno.env.get('RESEND_API_KEY');
  if (key && !contactId) {
    try {
      const r = await fetch('https://api.resend.com/contacts', {
        method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, unsubscribed: false, segments: [{ id: SEGMENT_ID }], properties: { locale, source } }),
      });
      const j: unknown = await r.json().catch(() => null);
      const cid = r.ok && j && typeof j === 'object' && typeof (j as { id?: unknown }).id === 'string' ? (j as { id: string }).id : null;
      if (cid) { const up = await db.from('subscribers').update({ resend_contact_id: cid }).eq('id', id); if (up.error) console.error('subscribers update', up.error); }
      else console.error('resend contact', r.status, j);
    } catch (e) { console.error('resend contact', e); }
  }
  return json(200, { ok: true }, h);
});
