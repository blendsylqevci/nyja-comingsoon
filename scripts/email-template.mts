// Regenerates supabase/functions/subscribe/email_sq.ts from the designer's confirmation email (email-sq.html, "Je lidhur — NYJA"):
//   node --experimental-strip-types scripts/email-template.mts
// The Edge Function imports the HTML as a string (the deploy bundles only modules, not static files). Edit the HTML, re-run, re-deploy.
import { readFileSync, writeFileSync } from 'node:fs';
const src = 'supabase/functions/subscribe/email-sq.html', out = 'supabase/functions/subscribe/email_sq.ts';
const html = readFileSync(src, 'utf8');
for (const needle of ['emri@domain.com', 'https://nyja-ks.com/cregjistrohu']) if (!html.includes(needle)) throw new Error('template lost its placeholder: ' + needle);
// A template literal, not JSON.stringify: the HTML has no backtick, no ${ and no backslash (checked), so the module is the HTML verbatim — the same bytes
// the MCP deploy carries (one level of escaping only), and a diff of the module reads like a diff of the HTML.
for (const bad of ['`', '${', '\\']) if (html.includes(bad)) throw new Error('template contains ' + JSON.stringify(bad) + ' — switch the module to JSON.stringify');
writeFileSync(out, '// Generated from email-sq.html by scripts/email-template.mts — do not edit; edit the HTML and re-run.\n// Placeholders the function fills: emri@domain.com (the address, twice) · https://nyja-ks.com/cregjistrohu (the unsubscribe link).\nexport const EMAIL_SQ: string = `' + html + '`;\n');
console.log('wrote', out, html.length, 'chars');
