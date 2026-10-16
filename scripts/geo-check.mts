// Sanity check for src/geo.ts against the real data — run from the repo root:
//   node --experimental-strip-types scripts/geo-check.mts
// Node's type stripping cannot resolve the extension-less './config' imports inside src, so the module is bundled in memory with the
// esbuild that ships with Vite and imported from a data: URL (no temp files). Every number below is one the prototype states
// (CLAUDE.md Screen 28 · v1.1: map boxes, chords ≈ 123 / 294 px, arcs ≈ 76 / 62 / 32 px, 23 stops) or a contract invariant from src/types.ts.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Canvas, Pt } from '../src/config.ts';
import type { GeoData, Geometry } from '../src/types.ts';

type Geo = { prep: (G: Canvas, data: GeoData) => Geometry; DESK: Canvas; MOB: Canvas; ARC: number; N: number; YG: { sw: number; rc: number }; STRAND: number };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = `export { prep } from './src/geo.ts'; export { DESK, MOB, ARC, N, YG, STRAND } from './src/config.ts';`;
const out = await build({ stdin: { contents: entry, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' });
const mod = (await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))) as Geo;
const data = JSON.parse(readFileSync(path.join(root, 'public/geo/west-balkans-ne10m.json'), 'utf8')) as GeoData;

let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++; };
const d = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const f1 = (v: number) => v.toFixed(1);
// Map boxes as the design states them: desktop 483 × 622 at (819,7), mobile 280 × 361 at (55,45).
const BOX: Record<string, { x0: number; y0: number; x1: number; y1: number }> = { d: { x0: 819, y0: 7, x1: 1302, y1: 629 }, m: { x0: 55, y0: 45, x1: 335, y1: 406 } };

for (const G of [mod.DESK, mod.MOB]) {
  const g = mod.prep(G, data);
  const box = BOX[G.key];
  console.log(`\n${G.key === 'd' ? 'DESK' : 'MOB'} (k ${G.k}, box ${box.x0}..${box.x1} × ${box.y0}..${box.y1})`);
  const names = ['Prishtinë', 'Shkup', 'Tiranë'];
  g.caps.forEach((c, i) => ok(c.x >= box.x0 && c.x <= box.x1 && c.y >= box.y0 && c.y <= box.y1, `${names[i]} (${f1(c.x)}, ${f1(c.y)}) inside the map box`));
  ok(g.caps[0].x > g.caps[2].x && g.caps[0].y < g.caps[2].y, 'Prishtinë is north-east of Tiranë');
  const chord = [d(g.caps[0], g.caps[1]), d(g.caps[1], g.caps[2]), d(g.caps[2], g.caps[0])];
  console.log(`       chords Prishtinë–Shkup ${f1(chord[0])} · Shkup–Tiranë ${f1(chord[1])} · Tiranë–Prishtinë ${f1(chord[2])}`);
  if (G.key === 'd') { ok(Math.abs(chord[0] - 123) <= 3, 'Prishtinë→Shkup chord ≈ 123 px (±3)'); ok(Math.abs(chord[2] - 294) <= 3, 'Prishtinë→Tiranë chord ≈ 294 px (±3)'); }
  ok(g.borders.map(b => b.code).join() === 'XK,AL,MK', 'borders sorted XK, AL, MK');
  ok(g.borders.every(b => /^M[\d.,-]+(L[\d.,-]+)+Z$/.test(b.d)), 'every border is one closed M…L…Z path');
  ok(g.clabels.length === 3 && g.clabels.every(c => typeof c.label === 'string' && c.x > 0 && c.y > 0), 'clabels: 3 labelled points');
  // Connections
  ok(g.eY.length === 3 && g.eY.every(p => p.length === mod.N), `eY = 3 × ${mod.N} points`);
  ok(g.eGeo.length === 3 && g.eGeo.every(p => p.length === mod.N), `eGeo = 3 × ${mod.N} points`);
  ok(g.eGeo.every((p, i) => d(p[0], g.caps[[0, 1, 2][i]]) < 1e-9 && d(p[mod.N - 1], g.caps[[1, 2, 0][i]]) < 1e-9), 'eGeo polylines start/end exactly on the capitals (EDGES order)');
  console.log(`       arcH ${g.arcH.map(f1).join(' / ')} · len ${g.len.map(f1).join(' / ')} · sStem ${f1(g.sStem)} · gapPx ${f1(g.gapPx)} · rc ${f1(g.rc)} · bh ${f1(g.bh)}`);
  ok(g.arcH.every((h, i) => Math.abs(h - mod.ARC * chord[i]) < 1e-9), 'arcH = ARC × chord, per connection');
  const order = (a: number[]) => a.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]).map(x => x[1]).join();
  ok(order(g.arcH) === order(chord), 'arcH ordering matches chord lengths');
  // The design quotes the desktop arcs as "≈ 76 / 62 / 32 px" (descending); in EDGES order they are Prishtinë–Shkup 32 · Shkup–Tiranë 62 · Tiranë–Prishtinë 76.
  if (G.key === 'd') { const s = g.arcH.slice().sort((a, b) => a - b); ok(Math.abs(s[0] - 32) < 2 && Math.abs(s[1] - 62) < 2 && Math.abs(s[2] - 76) < 2, 'desktop arcH set ≈ {32, 62, 76}'); }
  ok(g.traceD.length === 3 && g.traceD.every(t => t.startsWith('M') && t.length > 100), 'traceD: 3 ground traces');
  // Icon centreline ends: Prishtinë → loop top, Shkup → thread end (artboard cut), Tiranë → stem foot.
  const bw = G.ybox.w, wF = mod.STRAND * mod.YG.sw * bw;
  // Prishtinë's end is the ring SAMPLE nearest the top (ringRev[topI], −90.07° on both canvases), not the analytic top — the prototype's own choice, so a sub-0.1px offset is expected.
  ok(Math.abs(g.yEnd[0].x - g.yK.x) < .1 && Math.abs(g.yEnd[0].y - (g.yK.y - g.rc)) < .1, `yEnd[Prishtinë] = loop top (${f1(g.yEnd[0].x)}, ${f1(g.yEnd[0].y)}) — within 0.1px of (${f1(g.yK.x)}, ${f1(g.yK.y - g.rc)})`);
  ok(Math.abs(g.yEnd[1].x - (G.ybox.x + bw)) < 1e-6, `yEnd[Shkup] = thread end on the artboard cut x ${f1(g.yEnd[1].x)}`);
  ok(Math.abs(g.yEnd[2].y - (G.ybox.y + .8315 * g.bh)) < 1e-6, `yEnd[Tiranë] = stem foot y ${f1(g.yEnd[2].y)}`);
  // Strand ends: half a width inside the flat terminals (foot, cut); loop-top ends exactly on yP.
  ok(Math.abs(d(g.eY[0][mod.N - 1], g.yEnd[1]) - wF / 2) < 1e-6 && Math.abs(d(g.eY[1][0], g.yEnd[1]) - wF / 2) < 1e-6, `thread ends pulled in by wF/2 = ${f1(wF / 2)} px`);
  ok(Math.abs(d(g.eY[1][mod.N - 1], g.yEnd[2]) - wF / 2) < 1e-6 && Math.abs(d(g.eY[2][0], g.yEnd[2]) - wF / 2) < 1e-6, 'stem foot ends pulled in by wF/2');
  ok(d(g.eY[0][0], g.yEnd[0]) < 1e-9 && d(g.eY[2][mod.N - 1], g.yEnd[0]) < 1e-9, 'loop-top ends land exactly on yEnd[Prishtinë]');
  ok(Math.abs(g.gapPx - .0371 * bw) < 1e-9 && Math.abs(g.skel.sw - mod.YG.sw * bw) < 1e-9, 'gapPx / skel.sw scale with the artboard');
  // Route
  const R = g.route;
  ok(R.stops.length === 23, `route.stops.length = ${R.stops.length}`);
  ok(R.towns.length === 20, `route.towns.length = ${R.towns.length}`);
  ok(R.stops[0].tA === 0, 'stops[0].tA === 0');
  ok(R.stops[22].tA < 1 && R.stops[22].tD <= 1 + 1e-12, `last stop tA ${R.stops[22].tA.toFixed(4)} < 1, tD ${R.stops[22].tD.toFixed(4)}`);
  ok(R.stops.every((s, i) => i === 0 || (s.tA > R.stops[i - 1].tD && s.tD > s.tA)), 'schedule is monotonic (arrive after the previous departure)');
  ok(R.pts.length === 1 + 22 * 17 && R.cum.length === R.pts.length && R.stops[22].i === R.pts.length - 1, `route.pts = ${R.pts.length} (1 + 22 legs × 17), cum aligned, last stop at the end`);
  ok(Math.abs(R.len - R.cum[R.cum.length - 1]) < 1e-9 && R.len > 0, `route.len = ${f1(R.len)} px`);
  ok(R.stops.every(s => d(R.pts[s.i], s.p) < 1e-9), 'every stop sits on its route index');
  ok([0, 10, 20].every(i => R.stops[i].cap != null && d(R.stops[i].p, g.caps[R.stops[i].cap as number]) === 0 && R.stops[i].town === null), 'capitals reuse caps[] and carry town = null');
  ok(R.towns.every((t, j) => t.cap === null && t.town === j && t.side !== null && t.label === t.label.toUpperCase()), 'towns: cap null, town index in order, side set, UPPERCASE label');
  ok(R.stops[0].label === 'PRISHTINË' && R.stops[3].label === 'PRIZREN' && R.stops[20].label === 'SHKUP', 'labels uppercase (PRISHTINË · PRIZREN · SHKUP)');
  ok(R.d.startsWith('M') && R.d.split('L').length === R.pts.length, 'route.d has one segment per point');
  // Skeleton
  ok(g.skel.arm.length > 20 && g.skel.knot.length > 200, `skel paths non-empty (arm ${g.skel.arm.length} chars, knot ${g.skel.knot.length} chars)`);
  ok(g.skel.arm.startsWith('M') && g.skel.knot.startsWith('M'), 'skel paths are path data');
  ok(g.skel.box.x === G.ybox.x && g.skel.box.y === G.ybox.y && g.skel.box.w === bw && g.skel.box.h === g.bh, 'skel.box = the icon artboard');
  const armPts = g.skel.arm.slice(1).split('L').map(s => s.split(',').map(Number));
  ok(armPts.every(p => p[0] >= 0 && p[0] <= bw && p[1] >= 0 && p[1] <= g.bh), 'skel.arm is in icon-local px (inside the artboard)');
  // identD
  if (G.key === 'd') ok(typeof g.identD === 'string' && g.identD.startsWith('M' + g.yK.x + ',' + (g.yK.y - g.rc) + ' C') && g.identD.endsWith(' 140,56'), `identD = ${g.identD}`);
  else ok(g.identD === null, 'identD null on mobile');
  ok(d(g.proj(21.16688, 42.67272), g.caps[0]) < 1e-9, 'proj() reproduces the capitals');
}

console.log(fails ? `\n${fails} check(s) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
