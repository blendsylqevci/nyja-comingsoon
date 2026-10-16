// NYJA Coming Soon — constants transcribed verbatim from the approved design
// (NYJA-ComingSoon-Desktop-v1.1.dc.html, review decisions of 2026-10-15).
// Every number here is a design decision; change them only with the design.

export const CRIT = "'Criteria CF','Gotham',sans-serif";
export const EASE = 'cubic-bezier(.2,0,0,1)';
/** NYJA neon — the Y of the approved dark UI logo (brand/logo-dark-ui.png), sampled (213, 255, 0). */
export const MAT = '#D5FF00';
export const LAND = '#0F100E';
export const LAND_LIT = '#181A16';
export const EDGE = '#54584F';
export const EDGE_LIT = '#9CA096';
/** Device-glyph matrix: inside the countries, lit (hovered country / around the capitals), page ground, lamp, lamp core. */
export const DOT = '#33362F';
export const DOT_LIT = '#6E7268';
export const DOT_BG = '#17191A';
export const DOT_BG_LIT = '#2E312B';
export const DOT_BG_CORE = '#4A4E46';

export type Pt = { x: number; y: number };
export type Frac = [number, number];

/**
 * The NYJA icon = the knot alone — vector geometry from the approved uploads/NYJA_Logo_Icon-12.svg (1080 × 1080 artboard),
 * rendered as brand/nyja-icon-neon.svg. Centreline of the knot derived from that path, normalized to the artboard:
 * A = loop top (Prishtinë's end) · J stem top · B stem foot · K loop centre (rc centreline radius) · E riser→loop · X loop→thread ·
 * thread X→T (T = the artboard's right edge, where the artwork is cut). sw = stroke width, gap = the over-under gap at the junction.
 */
export const YG = {
  W: 1080, H: 1080,
  A: [.4167, .2074] as Frac, J: [.4361, .5167] as Frac, B: [.3967, .8315] as Frac, K: [.4167, .3065] as Frac,
  rc: .0991, E: [.5078, .3454] as Frac, X: [.3804, .3987] as Frac, sw: .1009, gap: .0371,
  // stem: flat foot (428,898) → vertical to y 702 → bend (r ≈ 214) into the 23° upper stem → cut centre J (471,558); the riser continues on the same 23° line and is tangent to the ring at E
  stem: [[.3967, .8315], [.3967, .6498], [.3986, .6222], [.4044, .5952], [.4124, .5724], [.4361, .5167]] as Frac[],
  // thread: leaves the ring tangentially at X, straight along the lower edge, then the mid-line of the two edge arcs (r 818 / 926) to the artboard cut at (1080, 553.5)
  thread: [[.3804, .3987], [.4676, .4343], [.5370, .4620], [.6157, .4898], [.7130, .5130], [.7731, .5213], [.8333, .5250], [.9074, .5231], [.9593, .5181], [1.0, .5125]] as Frac[],
};

export type YEnd = 'A' | 'B' | 'T';
export interface Capital { code: 'XK' | 'MK' | 'AL'; label: string; coord: string; name: string; country: string; lon: number; lat: number; end: YEnd; side: 'left' | 'right' }
/** Capitals (GeoNames city centres) and the icon end each one travels to: Prishtinë → loop top, Shkup → thread end, Tiranë → stem foot. */
export const CAPS: Capital[] = [
  { code: 'XK', label: 'PRISHTINË', coord: '42.67° N · 21.17° E', name: 'Prishtinë', country: 'Kosovë', lon: 21.16688, lat: 42.67272, end: 'A', side: 'right' },
  { code: 'MK', label: 'SHKUP', coord: '42.00° N · 21.43° E', name: 'Shkup', country: 'Maqedonia e Veriut', lon: 21.43141, lat: 41.99646, end: 'T', side: 'right' },
  { code: 'AL', label: 'TIRANË', coord: '41.33° N · 19.82° E', name: 'Tiranë', country: 'Shqipëri', lon: 19.81889, lat: 41.3275, end: 'B', side: 'right' },
];
/** Prishtinë – Shkup · Shkup – Tiranë · Tiranë – Prishtinë */
export const EDGES: [number, number][] = [[0, 1], [1, 2], [2, 0]];
export const CLABELS = [
  { code: 'XK', label: 'KOSOVË', lon: 20.75, lat: 42.85 },
  { code: 'AL', label: 'SHQIPËRI', lon: 20.12, lat: 40.42 },
  { code: 'MK', label: 'MAQEDONIA E VERIUT', lon: 21.78, lat: 41.52 },
];
export const ORDER: Record<string, number> = { XK: 0, AL: 1, MK: 2 };

/**
 * Device glyphs on a 16-unit box — 16 distinct glyphs, none repeated inside a pattern cell:
 * phone · laptop · mouse · headphones · gaming chair · PC tower · hair dryer · vacuum · TV · smartwatch · tablet · earbuds · speaker · camera · keyboard · drone.
 * 0.5px strokes via vector-effect: non-scaling-stroke (review 14 "not bold").
 */
export const DEVICES: string[][] = [
  ['M5 1.5h6a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z', 'M7 12.5h2'],
  ['M3 3.5h10v6.5H3z', 'M1 12.5h14', 'M6.5 12.5h3'],
  ['M8 2a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z', 'M8 2v4.5', 'M4 7h8'],
  ['M2 10V8a6 6 0 0 1 12 0v2', 'M2 9h2.5v4.5H2z', 'M11.5 9H14v4.5h-2.5z'],
  ['M5 2h6l1 7H4z', 'M3.5 9h9v2h-9z', 'M8 11v2.5', 'M5 14.5h6', 'M3.5 6.5H2', 'M12.5 6.5H14'],
  ['M4 1.5h8v13H4z', 'M6 4h4', 'M6 6h4', 'M9 11.5h.01'],
  ['M2 5h7a3 3 0 0 1 0 6H7l-2 4', 'M9 5a3 3 0 0 1 0 6', 'M2 5v6'],
  ['M6 14.5h4', 'M8 14.5V9', 'M8 9l4-7', 'M4.5 14.5a3.5 2 0 0 1 7 0'],
  ['M1.5 3h13v8h-13z', 'M5.5 13.5h5', 'M8 11v2.5'],
  ['M5 4.5h6v7H5z', 'M6 4.5V1.5h4v3', 'M6 11.5v3h4v-3', 'M11 7h1'],
  ['M2.5 3h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14.5 8h.01'],
  ['M4 5.5a2 2 0 1 1 0 .01', 'M12 5.5a2 2 0 1 1 0 .01', 'M3.5 7.5l-1 5', 'M12.5 7.5l1 5'],
  ['M4.5 1.5h7v13h-7z', 'M8 10.5a2 2 0 1 0 0-.01', 'M8 4.5h.01'],
  ['M1.5 5h3l1.5-2h4l1.5 2h3v8h-13z', 'M8 11.5a2.5 2.5 0 1 0 0-.01'],
  ['M1.5 5h13v6h-13z', 'M4 7.5h.01', 'M6.5 7.5h.01', 'M9 7.5h.01', 'M11.5 7.5h.01', 'M5 9.5h6'],
  ['M6 6h4v4H6z', 'M6 6L2.5 2.5', 'M10 6l3.5-3.5', 'M6 10l-3.5 3.5', 'M10 10l3.5 3.5', 'M2.5 2.5a1.5 1.5 0 1 0 0-.01', 'M13.5 2.5a1.5 1.5 0 1 0 0-.01', 'M2.5 13.5a1.5 1.5 0 1 0 0-.01', 'M13.5 13.5a1.5 1.5 0 1 0 0-.01'],
];

/**
 * One canvas. k = Mercator scale (px per radian), (mx,my) = map box origin (the data bbox's top-left), (ox,oy) = map centre = tilt / perspective origin,
 * tilt = plane angle at the geographic state, P = CSS perspective, pitch = matrix pitch, ybox = where the icon artboard lands, track = scroll length of the
 * transformation, bend = the connections' soft bend, halo = capital halo radius, torch = pointer-lamp radius, vanW = van sticker width,
 * townLabels = 'all' (desktop) | 'current' (mobile: only the current city is labelled), knot = where the "connection to the wordmark" ends (desktop only),
 * clabels = show country names + coordinates (desktop only), lab/clab = label sizes, hit = capital hover radius.
 */
export interface Canvas {
  key: 'd' | 'm'; W: number; H: number; k: number; mx: number; my: number; ox: number; oy: number; tilt: number; P: number; pitch: number; dot: number;
  ybox: { x: number; y: number; w: number }; track: number; bend: number; halo: number; torch: number; vanW: number; townLabels: 'all' | 'current';
  knot: { x: number; y: number } | null; clabels: boolean; lab: number; clab: number; hit: number;
}
export const DESK: Canvas = { key: 'd', W: 1440, H: 900, k: 7400, mx: 819, my: 7, ox: 1060, oy: 318, tilt: 52, P: 1400, pitch: 6, dot: 1, ybox: { x: 880, y: 100, w: 420 }, track: 600, bend: -12, halo: 110, torch: 200, vanW: 44, townLabels: 'all', knot: { x: 140, y: 56 }, clabels: true, lab: 11, clab: 10, hit: 90 };
export const MOB: Canvas = { key: 'm', W: 390, H: 844, k: 4300, mx: 55, my: 45, ox: 195, oy: 226, tilt: 48, P: 900, pitch: 5, dot: .9, ybox: { x: 45, y: 72, w: 300 }, track: 400, bend: -8, halo: 70, torch: 130, vanW: 30, townLabels: 'current', knot: null, clabels: false, lab: 10, clab: 9, hit: 60 };

/** Points per connection polyline. */
export const N = 96;
export const RAD = Math.PI / 180;
/** Connections are arcs lifted above the map plane (height ARC × chord), flat again by ARC_END of the track — before the morph; each has a ground trace on the land at TRACE. */
export const ARC = .26;
export const ARC_END = .45;
export const TRACE = .22;
/** Final strand width as a fraction of the icon's stroke. */
export const STRAND = .9;

export const PH = ['dark', 'map', 'caps', 'tour', 'links', 'ready'] as const;
export type Phase = typeof PH[number];
/** Intro schedule (ms → phase). 'links' + 'ready' follow the end of the tour (tick → tourDone). */
export const TIMES: Record<'first' | 'returning', [number, Phase][]> = { first: [[400, 'map'], [1500, 'caps'], [2000, 'tour']], returning: [[60, 'links'], [600, 'ready']] };
/** Tour length · emphasis decay of a city name after the van arrives (fraction of the tour). */
export const TOUR_MS = 24000;
export const EMF = .04;
/** Dwell at every stop (time units) and the per-leg time law: leg time ∝ 0.35 + length / mean. */
export const DWELL = .34;
export const LEG_BASE = .35;
/** One soft bend per leg: −0.09 × leg length. */
export const LEG_BEND = -.09;

export type TownSide = 'r' | 'l' | 'a' | 'b';
export interface Stop { n: string; cap?: number; lon?: number; lat?: number; side?: TownSide }
/** The NYJA van's route (review 9): Kosovo in the client's order, then Albania, then North Macedonia — soft lines; capitals reuse the CAPS nodes. */
export const STOPS: Stop[] = [
  { n: 'Prishtinë', cap: 0 }, { n: 'Gjilan', lon: 21.46923, lat: 42.4635, side: 'r' }, { n: 'Ferizaj', lon: 21.15528, lat: 42.37056, side: 'l' }, { n: 'Prizren', lon: 20.73972, lat: 42.21389, side: 'b' }, { n: 'Gjakovë', lon: 20.43083, lat: 42.38028, side: 'l' }, { n: 'Pejë', lon: 20.28842, lat: 42.65934, side: 'l' }, { n: 'Mitrovicë', lon: 20.86667, lat: 42.88333, side: 'a' },
  { n: 'Kukës', lon: 20.42189, lat: 42.07694, side: 'l' }, { n: 'Shkodër', lon: 19.51258, lat: 42.06828, side: 'l' }, { n: 'Durrës', lon: 19.45469, lat: 41.32355, side: 'l' }, { n: 'Tiranë', cap: 2 }, { n: 'Vlorë', lon: 19.48318, lat: 40.4686, side: 'l' }, { n: 'Korçë', lon: 20.78083, lat: 40.61861, side: 'b' }, { n: 'Pogradec', lon: 20.6525, lat: 40.9025, side: 'l' },
  { n: 'Strugë', lon: 20.67778, lat: 41.1775, side: 'a' }, { n: 'Ohër', lon: 20.80194, lat: 41.11722, side: 'b' }, { n: 'Manastir', lon: 21.33474, lat: 41.03143, side: 'b' }, { n: 'Prilep', lon: 21.55504, lat: 41.34514, side: 'r' }, { n: 'Veles', lon: 21.77556, lat: 41.71556, side: 'r' }, { n: 'Kumanovë', lon: 21.71444, lat: 42.13222, side: 'r' }, { n: 'Shkup', cap: 1 }, { n: 'Tetovë', lon: 20.97155, lat: 42.00972, side: 'a' }, { n: 'Gostivar', lon: 20.90819, lat: 41.79611, side: 'l' },
];

/** The official icon path (uploads/NYJA_Logo_Icon-12.svg, 1080-unit artboard), used verbatim — on the van's side panel. */
export const KNOT_D = 'M1036.27,504.11a818.49,818.49,0,0,1-371.06-32.39c-12.63-4.21-25.39-8.75-37.89-13.54-1.75-.65-3.57-1.36-5.31-2.07l-40.82-15.94v-.07l15.68-36.73,3.11-7.32a161.42,161.42,0,0,0-.91-129.62c-17.81-40.36-52.47-70.93-93.41-87.26l-.91-.26c-80.45-31.81-173.22,7.58-206.26,87.45l-1,2.66a161.65,161.65,0,0,0,2.39,129.69c14.77,32.65,40.69,58.76,72.1,75.79A151.08,151.08,0,0,0,393,484.41l16.06,6.29,26.56,10.43,102.29,40.1,41.46,16.26,2.59,1c11.6,4.53,23.26,8.87,35.11,12.82a925.64,925.64,0,0,0,434.68,41.66l28.24-4.08v-111ZM498.21,354.73l-3.69,8.48L478.78,400l-40.56-15.93-9.84-3.89a52.37,52.37,0,0,1-24.94-20.34,54.74,54.74,0,0,1-7.39-18.27,55.42,55.42,0,0,1,3.56-31.87l.52-1.55a49.78,49.78,0,0,1,46-30.64,45.06,45.06,0,0,1,17.81,3.5l5.83,2.2a52.84,52.84,0,0,1,30.9,33C504.69,328.81,503.26,342.55,498.21,354.73ZM419.83,537.86l-24.68,57.85a269.2,269.2,0,0,0-21.64,106.11V898H483.38V701.82a159.28,159.28,0,0,1,12.95-63l25.91-60.76Z';
/** The Screen 08 van silhouette (nyja-scene.jsx, nose left, 880 × 390 local units). */
export const VAN_BODY = 'M880 30 Q880 0 850 0 L300 0 C250 0 220 10 200 35 L105 150 L40 160 Q0 165 0 195 L0 295 Q0 322 28 322 L95 322 A70 70 0 0 1 235 322 L635 322 A70 70 0 0 1 775 322 L880 322 Z';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** localStorage key: set once the intro has played; returning visitors get the short entry. */
export const INTRO_KEY = 'nyja-cs-intro';
/** Below this viewport width the mobile canvas is used. */
export const MOBILE_MAX = 767;

export type Motion = 'full' | 'reduced' | 'static';
export type Visit = 'first' | 'returning';
