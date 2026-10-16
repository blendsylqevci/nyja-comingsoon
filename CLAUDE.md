# NYJA — Coming Soon (Screen 28 · v1.1)

Production port of an approved design prototype. The design is the source of truth; the code mirrors it number for number.

## Where things are
- `design/NYJA-ComingSoon-Desktop-v1.1.dc.html` — the approved prototype (read in line ranges; see `design/README.md` for the line map). `design/NYJA-design-rules.md` — the design rules; the "Screen 28 · v1.1" paragraph binds this site.
- `src/config.ts` — every constant (colours, icon centreline `YG`, capitals, canvases `DESK`/`MOB`, tour stops, timings). Change a value only when the design changes, and say which review it comes from.
- `src/math.ts` helpers · `src/types.ts` the contracts between modules · `src/geo.ts` `prep()` (projection, routes, morph targets — pure) · `src/stage.ts` the animated SVG network, rAF loop, phase machine, pointer lamp · `src/page.ts` the HTML composition, reveals, scale-to-fit · `src/form.ts` the launch form · `src/main.ts` bootstrap, QA params, `window.__nyja`.
- `src/styles.css` the page CSS (prototype inline styles as classes) · `src/ds.css` design-system Button/Input rules, verbatim.
- `tests/` Playwright (Chromium). `scripts/geo-check.mts` numeric check of `prep()` (`node --experimental-strip-types scripts/geo-check.mts`).

## Commands
`npm run dev` · `npm run build` (tsc strict + vite) · `npm test` (builds, then Playwright against `vite preview` on 4173) · `npm run typecheck`.
Before finishing any change: `npm run build && npm test` green. Tests drive the page only through `?motion= ?visit= ?canvas= ?tourms=` and `window.__nyja`.

## Rules
- Vanilla TypeScript, strict, no framework, no runtime dependencies, no `any`. Animation time is the rAF timestamp, never `Date.now()`.
- Two fixed canvases (1440 × 900 desktop, 390 × 844 mobile) scaled to fit and letterboxed; breakpoint 767 px. Don't invent fluid layouts.
- Colours: the page is black; the only accent is NYJA neon `#D5FF00`. `#99CC00` (Club material) never appears here. Greys from the design-system ramp only.
- Copy is Albanian with its diacritics (ë, ç) exactly as in the prototype; English is not duplicated.
- Comments explain non-obvious numbers and cite the prototype line / review number, like the existing code. Keep that density.
- Logos and the icon are the approved assets, never redrawn or recoloured. Store badges are the stores' own artwork (fallback pills when they fail to load).
- Fonts are licensed and not committed: `public/fonts/CriteriaCF-Regular.otf`, `Gotham-Book.otf` (gitignored). The Criteria CF DEMO cut lacks Ë/Ç; the `unicode-range` workaround in `styles.css` goes when the licensed cut arrives.
- `VITE_SUBSCRIBE_URL` set → the form POSTs JSON; unset → simulated prototype mode with the on-page note. Never pretend an email was registered.

## Decisions already taken (don't re-litigate without the designer)
- Flow pulses are hidden during the van tour (client request, reviews 11–12) even though the prototype's `place()` overwrote that gate.
- Reduced / static motion show the knot-to-wordmark connection at rest at opacity .6 (design prose), not hidden.
- If the geo data fails to load, the page renders the final brand composition (icon whole, neon period) without the map.
- Capital buttons rely on the lit state as their focus indication (prototype live player: `outline: none`).

## Pending for launch
Licensed fonts · real store links and final badge files (Apple's minimum is 40 px, design shows 32) · `VITE_SUBSCRIBE_URL` · Privatësia page and EN copy (links are `#`).
