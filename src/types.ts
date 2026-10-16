// Shared contracts between geo.ts (pure geometry), stage.ts (the animated network) and page.ts (the HTML composition).
import type { Canvas, Motion, Phase, Pt, TownSide, Visit } from './config';

/** public/geo/west-balkans-ne10m.json — WGS 84 [lon, lat] rings, Natural Earth 1:10m. */
export interface GeoCountry { code: string; name: string; rings: [number, number][][] }
export interface GeoData { countries: GeoCountry[] }

/** One stop of the van's route in tour time (0–1): tA = arrival, tD = departure, i = index into route.pts; cap = CAPS index or null; town = index into route.towns or null. */
export interface RouteStop { p: Pt; tA: number; tD: number; i: number; cap: number | null; town: number | null; label: string; side: TownSide | null }
export interface Route { pts: Pt[]; cum: number[]; len: number; d: string; stops: RouteStop[]; towns: RouteStop[] }
/** Mask skeleton (icon-local px): the centreline the connections morph onto; sw = icon stroke width in px; box = the icon artboard on the stage. */
export interface Skeleton { arm: string; knot: string; sw: number; box: { x: number; y: number; w: number; h: number } }

/** Everything prep() derives for one canvas — all in stage (design) px before the plane tilt. */
export interface Geometry {
  proj: (lon: number, lat: number) => Pt;
  /** Country outlines as closed path data, sorted XK, AL, MK (ORDER). */
  borders: { code: string; d: string }[];
  /** Projected capital centres, CAPS order. */
  caps: Pt[];
  clabels: (Pt & { label: string })[];
  /** N-point polylines per connection (EDGES order): target on the icon centreline, geographic curve. */
  eY: Pt[][];
  eGeo: Pt[][];
  /** Where each capital travels (CAPS order). */
  yEnd: Pt[];
  yK: Pt; yJ: Pt; rc: number; bh: number;
  skel: Skeleton;
  /** Polyline lengths per connection (EDGES order), stem length, over-under gap in px, arc heights, ground-trace path data. */
  len: number[]; sStem: number; gapPx: number; arcH: number[]; traceD: string[];
  route: Route;
  /** The connection from the knot to the wordmark (desktop only), else null. */
  identD: string | null;
}

/** HTML the page owns and the stage positions/colours every frame. */
export interface CapRefs { b: HTMLElement; t: HTMLElement; k: HTMLElement | null }
export interface TownRefs { w: HTMLElement; d: HTMLElement; t: HTMLElement }
export interface StageBindings {
  caps: CapRefs[];            // CAPS order: b = the 44×44 node block (left/top = caps[i] − 22), t = label, k = coordinate line (desktop) or null
  towns: TownRefs[];          // route.towns order: w = wrapper (0×0 at the town), d = 5px dot, t = label
  clabels: HTMLElement[];     // CLABELS order (desktop), [] on mobile
  cue: HTMLElement | null;    // the scroll-cue button
  knot: HTMLElement | null;   // the invisible knot button (visible from 90%)
  yimg: HTMLImageElement | null; // the icon <img>
  dot: HTMLElement | null;    // the period of LIDHET.
}
export interface StageHooks {
  /** After every phase change. cut = the tour was interrupted by scrolling (transitions must be instant). */
  onPhase(ph: Phase, cut: boolean): void;
  onHot(i: number | null): void;
  onSel(i: number | null): void;
  /** The stage asks the page to scroll its frame (design px). */
  scrollTo(topDesignPx: number, behavior: 'smooth' | 'auto'): void;
}
export interface StageOptions {
  G: Canvas; g: Geometry;
  /** The clipped stage box (W × H design px, perspective set by the page). The stage appends the plane + overlay SVGs here as its FIRST children. */
  stage: HTMLElement;
  /** Unclipped sibling box the page-ground SVG goes in (same coordinate origin as `stage`). */
  ground: HTMLElement;
  motion: Motion; mobile: boolean; hooks: StageHooks;
  /** Test hook only — overrides TOUR_MS. */
  tourMs?: number;
}
export interface StageApi {
  readonly phase: Phase;
  /** Eased scroll progress 0–1 (fk) and its target (form). */
  readonly progress: number; readonly target: number;
  readonly hot: number | null; readonly sel: number | null; readonly cut: boolean;
  /** Tour time 0–1. */
  readonly tour: number;
  bind(b: StageBindings): void;
  play(visit: Visit): void;
  skip(): void;
  ready(): boolean;
  setScroll(topDesignPx: number): void;
  /** Pointer in stage design px; client coords for elementFromPoint. */
  pointerMove(x: number, y: number, clientX: number, clientY: number): void;
  pointerLeave(): void;
  setHot(i: number | null): void;
  togglePick(i: number): void;
  /** Extend the page ground beyond the stage by (padX, padY) design px so it covers the letterboxed viewport. */
  setPad(padX: number, padY: number): void;
  destroy(): void;
}

export interface MountOptions { motion: Motion; visit: Visit; mobile: boolean; tourMs?: number }
export interface PageApi { stage: StageApi; frame: HTMLElement; scale: number; destroy(): void }
