// Geometry for one canvas — a faithful port of prep() in the approved design (NYJA-ComingSoon-Desktop-v1.1.dc.html, lines 241–277).
// Pure: no DOM, no time. Everything is in stage (design) px before the plane tilt; the stage projects it per frame.
import { ARC, CAPS, CLABELS, DWELL, EDGES, LEG_BASE, LEG_BEND, N, ORDER, RAD, STOPS, STRAND, YG, type Canvas, type Frac, type Pt, type YEnd } from './config';
import { ctrl, dOf, merc, polyLen, quadPts, resample } from './math';
import type { GeoData, Geometry, Route, RouteStop, Skeleton } from './types';

/** Projection + all geometry for one canvas: Mercator (conformal — shapes stay true), scale k, the data bbox's top-left at (mx,my). */
export function prep(G: Canvas, data: GeoData): Geometry {
  // The data bbox over ALL rings: lon0 = west-most vertex, lat1 = north-most vertex — they land at the map box origin (mx,my).
  let lon0 = 180, lat1 = -90;
  for (const c of data.countries) for (const r of c.rings) for (const p of r) { if (p[0] < lon0) lon0 = p[0]; if (p[1] > lat1) lat1 = p[1]; }
  const proj = (lon: number, lat: number): Pt => ({ x: G.mx + (lon - lon0) * RAD * G.k, y: G.my + (merc(lat1) - merc(lat)) * G.k });
  // Outlines as closed path data (1-decimal), in ORDER (XK, AL, MK) — the draw-on delay runs in this order.
  const borders = data.countries.slice().sort((a, b) => ORDER[a.code] - ORDER[b.code]).map(c => ({ code: c.code, d: c.rings.map(r => dOf(r.map(p => proj(p[0], p[1]))) + 'Z').join('') }));
  const caps = CAPS.map(c => proj(c.lon, c.lat));
  const clabels = CLABELS.map(c => ({ label: c.label, ...proj(c.lon, c.lat) }));
  // The icon artboard on the stage (square, so bh = bw); P maps an artboard fraction to stage px.
  const bx = G.ybox.x, by = G.ybox.y, bw = G.ybox.w, bh = bw * YG.H / YG.W, P = (a: Frac): Pt => ({ x: bx + a[0] * bw, y: by + a[1] * bh });
  const yJ = P(YG.J), yB = P(YG.B), yK = P(YG.K), yE = P(YG.E), yX = P(YG.X), rc = YG.rc * bw, thread = YG.thread.map(P);
  // Ring angles about K: E (riser → loop) and X (loop → thread) wound back one turn, so the sweep X → left → top → right → E is a single increasing range (271.6°).
  const aE = Math.atan2(yE.y - yK.y, yE.x - yK.x), aX = Math.atan2(yX.y - yK.y, yX.x - yK.x) - 2 * Math.PI;
  // 73 samples of the loop from X to E (the ring in reverse of its drawing direction E → top → X).
  const ringRev: Pt[] = []; for (let i = 0; i <= 72; i++) { const a = aX + (aE - aX) * i / 72; ringRev.push({ x: yK.x + rc * Math.cos(a), y: yK.y + rc * Math.sin(a) }); }
  const rev = <T>(a: T[]): T[] => a.slice().reverse();
  // The loop top (−90°) splits the ring: X → top and top → E; the sample at the top (yP) is Prishtinë's end.
  const topI = Math.round((-Math.PI / 2 - aX) / (aE - aX) * 72), ringXP = ringRev.slice(0, topI + 1), ringPE = ringRev.slice(topI), yP = ringRev[topI];
  const yEnd: Record<YEnd, Pt> = { A: yP, B: yB, T: thread[thread.length - 1] };
  // Final strand width in px; back(p, q, d) = p moved d px toward q.
  const wF = STRAND * YG.sw * bw, back = (p: Pt, q: Pt, d: number): Pt => { const L = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: p.x + (q.x - p.x) * d / L, y: p.y + (q.y - p.y) * d / L }; };
  const stem = YG.stem.map(P); stem[0] = back(stem[0], stem[1], wF / 2);
  const thr = thread.slice(); thr[thr.length - 1] = back(thr[thr.length - 1], thr[thr.length - 2], wF / 2);
  // Prishtinë–Shkup: loop top → X → thread · Shkup–Tiranë: thread back → the whole loop → riser → stem · Tiranë–Prishtinë: stem → riser → E → loop top. Strand ends sit half a width inside the flat terminals.
  const p0 = rev(ringXP).concat(thr.slice(1)), p1 = rev(thr).concat(ringRev.slice(1), rev(stem)), p2 = stem.concat([yE], rev(ringPE));
  const eY = [resample(p0, N), resample(p1, N), resample(p2, N)];
  const len = [polyLen(p0), polyLen(p1), polyLen(p2)], sStem = polyLen(stem);
  const eGeo = EDGES.map(([a, b]) => quadPts(caps[a], ctrl(caps[a], caps[b], G.bend), caps[b], N));
  const arcH = eGeo.map(p => ARC * Math.hypot(p[N - 1].x - p[0].x, p[N - 1].y - p[0].y)), traceD = eGeo.map(dOf);
  // The van's route: one soft bend per leg (same grammar as the connections), arc-length table, and a schedule — leg time ∝ 0.35 + length / mean, a short dwell at every stop.
  // Capitals reuse the caps[] nodes; towns carry their own lon/lat (STOPS guarantees one or the other).
  const SP = STOPS.map(st => st.cap != null ? caps[st.cap] : proj(st.lon!, st.lat!)); let rp: Pt[] = [SP[0]]; const si = [0], legs: number[] = [];
  for (let i = 0; i < SP.length - 1; i++) { const a = SP[i], b = SP[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y); rp = rp.concat(quadPts(a, ctrl(a, b, LEG_BEND * L), b, 18).slice(1)); si.push(rp.length - 1); legs.push(L); }
  const cum = [0]; for (let i = 1; i < rp.length; i++) cum.push(cum[i - 1] + Math.hypot(rp[i].x - rp[i - 1].x, rp[i].y - rp[i - 1].y));
  const meanL = legs.reduce((a, b) => a + b, 0) / legs.length, lw = legs.map(L => LEG_BASE + L / meanL), tot = lw.reduce((a, b) => a + b, 0) + DWELL * SP.length;
  // Schedule in tour time (0–1): arrive, dwell DWELL, leave, drive lw[i]; the last stop's dwell closes the tour.
  let tt = 0, tj = 0; const stops: RouteStop[] = SP.map((p, i) => { const tA = tt / tot; tt += DWELL; const tD = tt / tot; if (i < lw.length) tt += lw[i]; const st = STOPS[i]; return { p, tA, tD, i: si[i], cap: st.cap ?? null, town: st.cap == null ? tj++ : null, label: st.n.toUpperCase(), side: st.side ?? null }; });
  const route: Route = { pts: rp, cum, len: cum[cum.length - 1], d: dOf(rp), stops, towns: stops.filter(x => x.cap == null) };
  // Mask skeleton = the same centreline the connections morph onto; the official pixels are revealed outward from it. Icon-local px (artboard origin).
  const loc = (p: Pt): Pt => ({ x: p.x - bx, y: p.y - by });
  // Butt-ended so the flat foot and the artboard cut are revealed as soon as the strand reaches them; the arm overlaps into the ring past E (no wedge at the tangent).
  const skel: Skeleton = { arm: dOf(YG.stem.map(P).concat([yE, ringRev[69], ringRev[66]]).map(loc)), knot: dOf(ringRev.slice().reverse().concat(thread.slice(1)).map(loc)), sw: YG.sw * bw, box: { x: bx, y: by, w: bw, h: bh } };
  return {
    proj, borders, caps, clabels, eY, eGeo, yEnd: CAPS.map(c => yEnd[c.end]), yK, yJ, rc, bh, skel, len, sStem, gapPx: YG.gap * bw, arcH, traceD, route,
    // The connection from the knot to the wordmark (desktop only): a cubic leaving the loop top straight up (160px) and entering the logo corner from 40px right / 120px below it.
    identD: G.knot ? 'M' + yK.x + ',' + (yK.y - rc) + ' C' + yK.x + ',' + (yK.y - 160) + ' ' + (G.knot.x + 40) + ',' + (G.knot.y + 120) + ' ' + G.knot.x + ',' + G.knot.y : null,
  };
}
