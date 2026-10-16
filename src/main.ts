// Bootstrap — the prototype's componentDidMount (NYJA-ComingSoon-Desktop-v1.1.dc.html lines 229–239): motion from prefers-reduced-motion,
// visit from localStorage, the canvas by viewport width, the geo data → prep → the page, fonts.ready + 500ms → play (desktop).
// URL overrides for QA (?motion ?visit ?canvas ?tourms), re-mount on breakpoint / reduced-motion change, window.__nyja for the tests.
import './styles.css';
import './ds.css';
import { DESK, INTRO_KEY, MOB, MOBILE_MAX, type Canvas, type Motion, type Visit } from './config';
import { prep } from './geo';
import { mountPage } from './page';
import type { GeoData, Geometry, PageApi, StageApi } from './types';

export interface RemountOptions { motion?: Motion; visit?: Visit; canvas?: 'd' | 'm'; tourMs?: number }
export interface NyjaDebug { page: PageApi; stage: StageApi; canvas: 'd' | 'm'; motion: Motion; visit: Visit; remount(opts?: RemountOptions): NyjaDebug }
declare global { interface Window { __nyja?: NyjaDebug } }

const MOTIONS: readonly Motion[] = ['full', 'reduced', 'static'];
const VISITS: readonly Visit[] = ['first', 'returning'];
const CANVASES: readonly ('d' | 'm')[] = ['d', 'm'];
const pick = <T extends string>(v: string | null, allowed: readonly T[]): T | undefined => (v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

const q = new URLSearchParams(location.search);
/** QA overrides: fixed for the session (remount() may change them); undefined = follow the environment. */
const forced: RemountOptions = { motion: pick(q.get('motion'), MOTIONS), visit: pick(q.get('visit'), VISITS), canvas: pick(q.get('canvas'), CANVASES) };
const qTour = Number(q.get('tourms'));
let tourMs: number | undefined = Number.isFinite(qTour) && qTour > 0 ? qTour : undefined;

let rmq: MediaQueryList | null = null;
try { rmq = matchMedia('(prefers-reduced-motion: reduce)'); } catch { rmq = null; }
const motionNow = (): Motion => forced.motion ?? (rmq && rmq.matches ? 'reduced' : 'full');
// returning visitors (the intro was seen once, line 231 / 239) get the short entry
const visitNow = (): Visit => { if (forced.visit) return forced.visit; try { return localStorage.getItem(INTRO_KEY) === 'seen' ? 'returning' : 'first'; } catch { return 'first'; } };
const canvasNow = (): Canvas => (forced.canvas ? (forced.canvas === 'm' ? MOB : DESK) : window.innerWidth <= MOBILE_MAX ? MOB : DESK);
const fontsReady = (): Promise<unknown> => { try { return document.fonts.ready; } catch { return Promise.resolve(); } };
const debounce = (fn: () => void, ms: number) => { let t: number | undefined; return () => { clearTimeout(t); t = window.setTimeout(fn, ms); }; };

// geometry per canvas, derived once from the fetched data (prep is pure)
let data: GeoData | null = null;
const geoms = new Map<'d' | 'm', Geometry>();
function geomFor(G: Canvas): Geometry | null {
  if (!data) return null;
  const cached = geoms.get(G.key); if (cached) return cached;
  try { const g = prep(G, data); geoms.set(G.key, g); return g; } catch (e) { console.warn('geo prep', e); return null; }
}
const asGeo = (j: unknown): GeoData => { if (typeof j === 'object' && j !== null && Array.isArray((j as { countries?: unknown }).countries)) return j as GeoData; throw new Error('geo: unexpected shape'); };

let current: PageApi | null = null, currentKey: 'd' | 'm' | null = null;
function mount(root: HTMLElement): NyjaDebug {
  if (current) current.destroy();
  const G = canvasNow(), motion = motionNow(), visit = visitNow();
  const page = mountPage(root, G, geomFor(G), { motion, visit, mobile: G.key === 'm', tourMs });
  current = page; currentKey = G.key;
  // desktop: the intro plays once the fonts are in, +500ms (line 234); mobile has no play — the tour starts on mount
  if (G.key === 'd') fontsReady().then(() => setTimeout(() => { if (current === page) page.stage.play(visit); }, 500));
  const dbg: NyjaDebug = {
    page, stage: page.stage, canvas: G.key, motion, visit,
    remount(opts = {}) {
      if (opts.motion) forced.motion = opts.motion;
      if (opts.visit) forced.visit = opts.visit;
      if (opts.canvas) forced.canvas = opts.canvas;
      if (opts.tourMs != null) tourMs = opts.tourMs;
      return mount(root);
    },
  };
  window.__nyja = dbg;
  return dbg;
}

const root = document.getElementById('app');
if (root) {
  fetch('/geo/west-balkans-ne10m.json')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(j => { data = asGeo(j); })
    // a failed fetch still renders the composition — logo, statement, badges, form, footer — without the map
    .catch(e => { console.warn('geo data', e); })
    .then(() => { mount(root); });
  // breakpoint crossing → the other canvas; reduced-motion change → the other motion mode (both re-mount; the intro replays as seen)
  window.addEventListener('resize', debounce(() => { if (current && !forced.canvas && canvasNow().key !== currentKey) mount(root); }, 150));
  if (rmq) rmq.addEventListener('change', debounce(() => { if (current && !forced.motion) mount(root); }, 150));
}
