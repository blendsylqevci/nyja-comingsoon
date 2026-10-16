// Geometry helpers — transcribed from the approved design (NYJA-ComingSoon-Desktop-v1.1.dc.html).
import { RAD, type Pt } from './config';

/** Mercator y for a latitude in degrees. */
export const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2));
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (f: number) => f * f * (3 - 2 * f);
export const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
/** Control point of a soft quadratic bend: the chord's midpoint pushed k px to the side. */
export const ctrl = (A: Pt, B: Pt, k: number): Pt => { const m = mid(A, B); let dx = B.x - A.x, dy = B.y - A.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L; return { x: m.x - dy * k, y: m.y + dx * k }; };
/** n points on the quadratic s → c → e. */
export const quadPts = (s: Pt, c: Pt, e: Pt, n: number): Pt[] => { const o: Pt[] = []; for (let i = 0; i < n; i++) { const t = i / (n - 1), u = 1 - t; o.push({ x: u * u * s.x + 2 * u * t * c.x + t * t * e.x, y: u * u * s.y + 2 * u * t * c.y + t * t * e.y }); } return o; };
export const polyLen = (p: Pt[]) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return L; };
/** The three connections are exactly on the centreline from 72%; the strand thickens after that. */
export const geoE = (f: number) => smooth(clamp(f / .72));
/** Resample a polyline to n points equally spaced by arc length. */
export const resample = (poly: Pt[], n: number): Pt[] => { const L = [0]; for (let i = 1; i < poly.length; i++) L.push(L[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y)); const tot = L[L.length - 1] || 1; const o: Pt[] = []; let j = 0; for (let i = 0; i < n; i++) { const s = tot * i / (n - 1); while (j < L.length - 2 && L[j + 1] < s) j++; const a = poly[j], b = poly[j + 1] || a, seg = (L[j + 1] - L[j]) || 1, t = clamp((s - L[j]) / seg); o.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); } return o; };
/** SVG path data for a polyline (1-decimal). */
export const dOf = (pts: Pt[]) => pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join('');
export const lerpPts = (a: Pt[], b: Pt[], e: number): Pt[] => a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * e, y: p.y + (b[i].y - p.y) * e }));
/** Pick a transition per motion mode: full → `full`, reduced → `red` (or none), static → none. */
export const tr = (m: string, full: string, red?: string) => m === 'full' ? full : m === 'reduced' ? (red || 'none') : 'none';
