# Design reference (read-only)

The approved design this site is a port of — from the Claude Design project "NYJA WEB DESIGN" (exported 2026-10-15; last synced 2026-10-16 through the design MCP, `DesignSync get_file`). Kept here so a coding session has the source of truth next to the code.

- `NYJA-ComingSoon-Desktop-v1.1.dc.html` — Screen 28 · Coming Soon v1.1, the prototype. Template: desktop lines 36–72, mobile 82–106. Logic: constants 143–224, class 226–537 (`prep` 241, `play/skip` 279, `touchLamp` 301, `tiltOf/proj3` 311, `vanAt` 316, `place` 336, `tick` 369, `net` 389, `frame` 444, `mframe` 500, `cueNode` 528, `townVals` 533). Lines are very long — read it in ranges. It is a Claude Design "DC" file: it needs the full export (`support.js`, the `_ds/` design-system bundle, `brand/`, `geo/`) to render, so treat it as a reading reference, not something to open in a browser.
- `NYJA-design-rules.md` — the design project's rules (all screens). The "Screen 28 · v1.1" paragraph is the one that binds this site: every number in `src/config.ts` comes from it.
- `NYJA_Logo_Icon-12.svg` — the client's vector of the icon (1080 × 1080 artboard). `public/brand/nyja-icon-neon.svg` is its knot path, verbatim, in `#D5FF00`.

Not included: the chat transcripts, the other 49 screens, the design-system bundle and the fonts — they live in the Claude Design export (the handoff zip).

If a new design revision arrives (a new export), replace the `.dc.html` here and diff it against the previous one; the port's comments cite prototype line numbers, so a line-range diff points straight at the code to change.
