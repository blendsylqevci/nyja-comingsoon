// supabase/functions/unsubscribe/index.ts — the "Çregjistrohu" link of the confirmation email: GET or POST ?t=<subscriber id> (the id is the
// token: a v4 uuid, unguessable). Also RFC 8058 one-click (POST List-Unsubscribe=One-Click from the mail client, same handling). Marks the row
// (unsubscribed_at), unsubscribes the Resend contact from every broadcast, and answers with a small page in the signup's language.
// Deployed with verify_jwt off. The Resend key: the secret RESEND_API_KEY, else Vault through public.resend_api_key() (without either only the row is marked).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function resendKey(db: SupabaseClient): Promise<string | undefined> {
  const env = Deno.env.get('RESEND_API_KEY'); if (env) return env;
  const r = await db.rpc('resend_api_key'); if (r.error) { console.error('vault key', r.error); return undefined; }
  return typeof r.data === 'string' && r.data.length > 0 ? r.data : undefined;
}
type Lang = 'sq' | 'en';
const COPY: Record<Lang, { ok: string; okText: string; bad: string; badText: string }> = {
  sq: { ok: 'U çregjistrove.', okText: 'Nuk do të marrësh më email nga NYJA për lansimin.', bad: 'Linku nuk është i vlefshëm.', badText: 'Hape emailin nga NYJA dhe shtyp përsëri "Çregjistrohu".' },
  en: { ok: 'You are unsubscribed.', okText: 'You will get no more emails from NYJA about the launch.', bad: 'This link is not valid.', badText: 'Open the email from NYJA and press "Unsubscribe" again.' },
};
/** The answer page: black, the email's type (Helvetica), the period in neon — like the site and the email. */
const page = (lang: Lang, ok: boolean, status: number) => {
  const c = COPY[lang], h1 = ok ? c.ok : c.bad, p = ok ? c.okText : c.badText;
  const html = '<!doctype html><html lang="' + lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>' + h1 + ' — NYJA</title>' +
    '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;text-align:center;padding:24px;box-sizing:border-box}main{max-width:520px}.k{font-size:11px;letter-spacing:.32em;color:#9CA096;margin:0 0 22px}h1{font-size:40px;line-height:1;margin:0 0 20px;font-weight:400;text-transform:uppercase}h1 span{color:#D5FF00}p{font-size:17px;line-height:1.6;margin:0 0 32px}a{color:#9CA096}</style></head>' +
    '<body><main><p class="k">NYJA-KS.COM</p><h1>' + h1.replace(/\.$/, '<span>.</span>') + '</h1><p>' + p + '</p><p><a href="https://nyja-ks.com">nyja-ks.com</a></p></main></body></html>';
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') return new Response(null, { status: 405 });
  const t = new URL(req.url).searchParams.get('t') ?? '';
  if (!UUID_RE.test(t)) return page('sq', false, 400);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const got = await db.from('subscribers').select('id, locale, resend_contact_id, unsubscribed_at').eq('id', t).maybeSingle<{ id: string; locale: string; resend_contact_id: string | null; unsubscribed_at: string | null }>();
  if (got.error) { console.error('subscribers select', got.error); return page('sq', false, 500); }
  if (!got.data) return page('sq', false, 404);
  const lang: Lang = got.data.locale === 'en' ? 'en' : 'sq';
  if (!got.data.unsubscribed_at) {
    const up = await db.from('subscribers').update({ unsubscribed_at: new Date().toISOString() }).eq('id', t);
    if (up.error) { console.error('subscribers unsubscribe', up.error); return page(lang, false, 500); }
  }
  const key = await resendKey(db);
  if (key && got.data.resend_contact_id) {
    try {
      const r = await fetch('https://api.resend.com/contacts/' + got.data.resend_contact_id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ unsubscribed: true }) });
      if (!r.ok) console.error('resend unsubscribe', r.status, await r.text().catch(() => ''));
    } catch (e) { console.error('resend unsubscribe', e); }
  }
  return page(lang, true, 200);
});
