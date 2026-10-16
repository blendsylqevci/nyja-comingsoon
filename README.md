# NYJA — Coming Soon (Screen 28 · v1.1)

The pre-launch page of NYJA, "GJITHÇKA LIDHET." — a production port of the approved design prototype (`NYJA-ComingSoon-Desktop-v1.1`, review decisions of 2026-10-15). Kosovo, Albania and North Macedonia are drawn from real geography on a tilted map plane; the NYJA van tours 23 cities; the three connections between Prishtinë, Shkup and Tiranë then travel, on scroll, onto the centreline of the NYJA icon until the official artwork is revealed under them. Below it: the launch-notification form, the store badges and the footer. Albanian UI with an English switch (SQ · EN in the footer), black in every context, neon `#D5FF00` only.

## Stack

Vite 6 + vanilla TypeScript (strict, no framework, no runtime dependencies). SVG + a handful of HTML elements positioned by the same projection as the plane, driven by one `requestAnimationFrame` loop. Playwright (Chromium) for the tests.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc (strict) + vite build → dist/
npm run preview    # serves dist/ on http://localhost:4173
npm test           # builds, then runs Playwright against the preview
```

## Fonts (not in the repo)

`public/fonts/` is gitignored. Drop the licensed `CriteriaCF-Regular.otf` and `Gotham-Book.otf` in there; `index.html` preloads both. The Criteria CF DEMO cut lacks Ë/Ç and ships watermark outlines for digits and punctuation, so `src/styles.css` carries a temporary `unicode-range` `@font-face` that routes those code points to Gotham (`--font-display` falls back to Gotham for Ë/Ç). **Delete that workaround once the licensed Criteria CF cut arrives.**

## Subscribe endpoint

Set `VITE_SUBSCRIBE_URL` at build time (`.env` is gitignored; see `.env.example`):

```sh
VITE_SUBSCRIBE_URL=https://kgbuquggwvnclqnyvbsl.supabase.co/functions/v1/subscribe
```

The form then `POST`s JSON — `{ "email": "...", "locale": "sq" | "en", "source": "coming-soon" }` — and treats a 2xx response as success; anything else (or a network error) shows the error state with "Provo përsëri". When the variable is **unset** the form runs in simulated prototype mode: 900 ms delay, success for every valid address, failure for addresses containing "gabim", and the on-page label "Prototip UI/UX — asnjë email nuk regjistrohet." is shown. No email is stored anywhere.

The live endpoint (2026-10-16) is the Supabase project **"Nyja Coming Soon"** (`kgbuquggwvnclqnyvbsl`, eu-north-1):

- `public.subscribers` — one row per address (lower-cased, unique), `locale`, `source`, `resend_contact_id`, `created_at`; RLS on with no policies, so only the service role writes. Migration: `supabase/migrations/20261016120000_create_subscribers.sql`.
- Edge Function `subscribe` — source `supabase/functions/subscribe/index.ts`, deployed with `verify_jwt` off (the page calls it anonymously). It validates the address with the page's own rule, stores it (a repeat signup is a 2xx too and keeps the first row), and, when the secret `RESEND_API_KEY` is set, creates the contact in the Resend segment **"Coming soon"** with the contact properties `locale` and `source`, remembering its id. Optional secrets: `RESEND_SEGMENT_ID` (override), `ALLOWED_ORIGINS` (comma-separated; default `*`). Secrets live in Supabase → Edge Functions → Secrets, never in the repo.
- Resend (free plan: 3 000 emails / month, 100 / day, 1 000 contacts): the launch mail is a Broadcast to that segment; sending needs a verified domain first.

## Store badges

The two badges are the stores' own artwork, loaded unmodified from the official sources (Apple's App Store Marketing Tools badge API and Google's `play.google.com` badge image); if either fails to load, both are replaced by the outline pills. For production:

- download the final files from Apple's App Store Marketing Tools and Google's badge generator (they also produce the per-app links and localized variants) and link the real store pages instead of `#`;
- Apple's badge may only be shown once the app is listed on the App Store (a pre-order badge exists);
- the badges are 32 px tall per review 7; Apple's guideline minimum is 40 px — production may need to restore that.

## QA: URL parameters and `window.__nyja`

| param | values | default |
|---|---|---|
| `?motion=` | `full` · `reduced` · `static` | follows `prefers-reduced-motion` |
| `?visit=` | `first` · `returning` | `returning` once the intro was seen (`localStorage['nyja-cs-intro']`) |
| `?canvas=` | `d` · `m` | `m` when `innerWidth ≤ 767`, else `d` |
| `?tourms=` | tour length in ms | `24000` |
| `?lang=` | `sq` · `en` | the footer's choice (`localStorage['nyja-cs-lang']`), else `sq` |

`window.__nyja = { page, stage, canvas, motion, visit, remount(opts) }`. `stage` exposes `phase` (`dark → map → caps → tour → links → ready`), `progress` (eased scroll progress 0–1) and `target`, `hot` / `sel` (hovered / pinned capital index), `cut` (the tour was interrupted by scrolling), `tour` (0–1), `ready()`, `skip()`, `play('first' | 'returning')` and `setScroll(designPx)`. The scroll container is `.cs-frame`; the track is `600 × scale` px on desktop and `400 × scale` on mobile (`page.scale`). Keyboard: `Esc` skips the intro, and at `ready` scrolls back to the top.

Touch (both canvases, full motion): the pointer lamp follows the finger through passive `touchstart` / `touchmove` / `touchend` / `touchcancel` listeners on the frame — the whole viewport, letterbox included, in the stage's coordinates — because they keep firing while the frame scrolls, where pointer events get `pointercancel` the moment a pan starts (pointer events of type `touch` are ignored). Every sample is drawn at once, not on the next frame; while the frame scrolls under a finger the lamp follows the scroll as well (finger y = the last sample − the scroll since it), so it keeps moving even where a browser withholds `touchmove` while scrolling. Under a finger the light sits exactly where the finger is (the mouse keeps its soft spring) and the ground copies are a touch brighter (`DOT_BG_LIT_TOUCH` / `DOT_BG_CORE_TOUCH`); the lamp holds 1200 ms after the finger lifts, then fades (900 ms); on the desktop canvas the finger also tilts the plane. The lamp's lit copies are circles of its own radius through the torch masks, not full-screen masked rects: what is rasterized per frame is the lamp, not the screen.

Language: Albanian is the primary language; `src/i18n.ts` holds both copies and the English place names (Pristina, Skopje, Tirana, Gjakova, Peja …). The footer's SQ · EN re-mounts the page in the other language at the same scroll position, writes `localStorage['nyja-cs-lang']` and sets `<html lang>`, `document.title` and the meta description; `?lang=` forces a language for the session without writing it. The store badges are the stores' English artwork in both. The English copy is not in the prototype — it awaits the designer's review (the statement "Everything / Connects." above all).

## Tests

`npm test` runs `tests/*.spec.ts` in Chromium against `vite preview` (desktop 1440 × 900, mobile 390 × 844): zero console/page errors, the intro phases, skip / Escape, the scroll-driven transformation (icon, mask, cue, period, knot button), cutting and restarting the tour, capital hover / pin and their aria state, the finger lamp (touch on both canvases: glued to the finger, brighter, the hold after lift, the plane tilt on desktop), the English copy and the SQ · EN switch (persistence, scroll kept), the form states, reduced and static motion, the mobile tour, form reachability and horizontal overflow. Stills for review land in `test-results/shots/` (`desktop-ready`, `desktop-50`, `desktop-100`, `desktop-reduced`, `desktop-static`, `mobile-0`, `mobile-400`).

Notes: `playwright.config.ts` uses the CI sandbox's pre-installed browser (`/opt/pw-browsers/chromium`) when that path exists; elsewhere run `npx playwright install chromium` once. The badge test accepts either outcome: the stores' own artwork where their hosts answer (a developer's machine), the fallback pills where they do not (the CI sandbox, whose two image failures the console check ignores) — production loads the official badges. The form tests assume simulation mode (`VITE_SUBSCRIBE_URL` unset; they skip themselves otherwise). A missing licensed font is tolerated (the page falls back to the system families), so the suite also passes on a fresh clone without `public/fonts/`.

## Design provenance

- Map: Natural Earth 1:10m via `world-atlas@2.0.2` → `public/geo/west-balkans-ne10m.json` (WGS 84, simplified at 0.006°), one Mercator projection (desktop k 7400 px/rad, mobile 4300).
- Capitals: GeoNames city centres (Prishtinë 42.67272 / 21.16688 · Shkup 41.99646 / 21.43141 · Tiranë 41.3275 / 19.81889); the 23 tour stops likewise.
- Icon: the knot path of the approved `NYJA_Logo_Icon-12.svg` (1080 × 1080 artboard), used verbatim as `public/brand/nyja-icon-neon.svg`; the centreline the connections morph onto is derived from that path. Logo: the approved `logo-dark-ui.png`; the neon `#D5FF00` is its Y, sampled.
- Every constant lives in `src/config.ts` with the review it comes from; change them only with the design.

## Responsive strategy

Two fixed canvases — desktop 1440 × 900 and mobile 390 × 844 — each scaled to fit the viewport (`s = min(vw / W, vh / H)`), centred and letterboxed on black with the device-glyph ground extended to the viewport edges. The breakpoint is 767 px (`innerWidth ≤ 767` → mobile); crossing it, or a change of `prefers-reduced-motion`, re-mounts the page. On both canvases the stage is pinned and the first 600 (desktop) / 400 (mobile) design px of scroll drive the transformation; on mobile the form and footer follow in flow below the track.
