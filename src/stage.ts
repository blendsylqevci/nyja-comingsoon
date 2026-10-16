// The animated network — a vanilla-DOM port of the approved design's net() / place() / tick / phase machine
// (NYJA-ComingSoon-Desktop-v1.1.dc.html, lines 279–443: play / skip 279–288, touchLamp 301–310, place 336–368, tick 369–388, net 389–443,
// and the pointer handling of frame().onMove / onLeave (476–477) and mframe().onMove / onLeave (515)).
// One registry object (`n`, the prototype's `reg`) holds every DOM ref and all per-frame state; what React re-rendered on a
// phase change is re-applied by applyPhase(). Animation time is the rAF timestamp, as in the prototype — never Date.now().
import {
  ARC_END, CAPS, DEVICES, DOT, DOT_BG, DOT_BG_CORE, DOT_BG_LIT, DOT_LIT, EASE, EDGE, EDGE_LIT, EDGES, EMF, INTRO_KEY, KNOT_D, LAND, LAND_LIT, MAT, N, PH, RAD, STRAND, TIMES, TOUR_MS, TRACE, VAN_BODY,
  type Canvas, type Motion, type Phase, type Pt, type Visit,
} from './config';
import { clamp, dOf, geoE, lerpPts, smooth, tr } from './math';
import type { CapRefs, Geometry, StageApi, StageBindings, StageHooks, StageOptions, TownRefs } from './types';

const NS = 'http://www.w3.org/2000/svg';
/** p at or past phase k. */
const ge = (p: Phase, k: Phase) => PH.indexOf(p) >= PH.indexOf(k);

type Attrs = Record<string, string | number>;
type Style = Partial<CSSStyleDeclaration>;
/** The prototype's h() for SVG: createElementNS + presentation attributes (kebab-case, as React emits them) + inline style + children. */
function sv<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs | null, style?: Style | null, kids?: (Element | null)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  if (style) Object.assign(el.style, style);
  if (kids) for (const c of kids) if (c) el.appendChild(c);
  return el;
}

type Tilt = { ax: number; ay: number };
type VanPos = Pt & { dist: number; dx: number; dy: number; moving: boolean };

/** The registry — the prototype's `reg` / `n`: every DOM ref the stage drives and all per-frame state. */
interface Reg {
  // SVG, built by net()
  bg: SVGSVGElement | null; plane: HTMLDivElement | null; ov: SVGSVGElement | null;
  bgRects: SVGRectElement[]; tm: SVGMaskElement | null; tmc: SVGMaskElement | null;
  edges: SVGPathElement[]; pulses: SVGPathElement[]; borders: SVGPathElement[]; dots: SVGPathElement[]; traces: SVGPathElement[];
  grads: SVGLinearGradientElement[]; gstops: SVGStopElement[][]; halos: SVGCircleElement[];
  trail: SVGPathElement | null; haloG: SVGGElement | null; torch: SVGCircleElement | null; torchC: SVGCircleElement | null; torchG: SVGGElement | null;
  van: SVGGElement | null; ident: SVGPathElement | null;
  // HTML the page owns, handed over by bind()
  caps: CapRefs[]; towns: TownRefs[]; clabels: HTMLElement[]; yimg: HTMLImageElement | null; cue: HTMLElement | null; knot: HTMLElement | null; dot: HTMLElement | null;
  // per-frame state
  ph: Phase; fk: number; form: number; tour: number; tourT0: number | null; tourEnd: boolean; cut: boolean;
  px: number; py: number; tx: number; ty: number; ptr: Pt | null; lx: number | null; ly: number | null; vx: number; vy: number; torchOn: number | null; vanDir: number;
  /** A finger is on the stage (touchLamp): a pointer leave must not put the lamp out; lift = the 1200ms hold after the finger lifts. */
  touch: boolean; lift: ReturnType<typeof setTimeout> | undefined;
  maskKey: string | null; identOn: boolean; lastFk: number; lastTour: number; dirty: boolean; hot: number | null; sel: number | null; scr: Pt[] | null;
}

export class Stage implements StageApi {
  private readonly G: Canvas;
  private readonly g: Geometry;
  private readonly m: Motion;
  private readonly mobile: boolean;
  private readonly hooks: StageHooks;
  private readonly tourMs: number;
  /** Reduced / static: the follow snaps instead of easing (the prototype's `reg.snap`). */
  private readonly snap: boolean;
  private readonly n: Reg;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private raf = 0;
  private dead = false;
  /** Removes the touch listeners of touchLamp (destroy). */
  private untouch: (() => void) | null = null;

  constructor(o: StageOptions) {
    this.G = o.G; this.g = o.g; this.m = o.motion; this.mobile = o.mobile; this.hooks = o.hooks; this.tourMs = o.tourMs ?? TOUR_MS;
    this.snap = this.m !== 'full';
    this.n = {
      bg: null, plane: null, ov: null, bgRects: [], tm: null, tmc: null,
      edges: [], pulses: [], borders: [], dots: [], traces: [], grads: [], gstops: [], halos: [],
      trail: null, haloG: null, torch: null, torchC: null, torchG: null, van: null, ident: null,
      caps: [], towns: [], clabels: [], yimg: null, cue: null, knot: null, dot: null,
      // Desktop: 'dark' until play(). Mobile: no timers — with full motion the tour simply starts (phase 'tour'); otherwise the finished state ('links', tour 1) from the first frame.
      ph: this.mobile ? (this.m === 'full' ? 'tour' : 'links') : 'dark', fk: 0, form: 0, tour: this.mobile && this.m !== 'full' ? 1 : 0, tourT0: null, tourEnd: false, cut: false,
      px: 0, py: 0, tx: 0, ty: 0, ptr: null, lx: null, ly: null, vx: 0, vy: 0, torchOn: null, vanDir: 0, touch: false, lift: undefined,
      maskKey: null, identOn: false, lastFk: -1, lastTour: -1, dirty: true, hot: null, sel: null, scr: null,
    };
    this.net(o.stage, o.ground);
    this.touchLamp(o.stage);
    this.applyPhase();
    this.raf = requestAnimationFrame(this.tick);
  }

  get phase(): Phase { return this.n.ph; }
  get progress(): number { return this.n.fk; }
  get target(): number { return this.n.form; }
  get hot(): number | null { return this.n.hot; }
  get sel(): number | null { return this.n.sel; }
  get cut(): boolean { return this.n.cut; }
  get tour(): number { return this.n.tour; }

  /** The phase gate the prototype's render used: desktop = motion !== 'full' || phase ≥ k; mobile = borders / dots / halo / capitals from the first frame, only 'links' / 'ready' wait for the tour's end ("done"). */
  private on(k: Phase): boolean { return this.mobile ? ((k === 'links' || k === 'ready') ? ge(this.n.ph, 'links') : true) : (this.m !== 'full' || ge(this.n.ph, k)); }
  private setPh(ph: Phase) { this.n.ph = ph; this.applyPhase(); this.hooks.onPhase(ph, this.n.cut); }
  private clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }

  play(visit: Visit) {
    this.clearTimers();
    if (this.mobile) {
      // Mobile has no intro schedule: playing again = the tour from Prishtinë (what restartTour does when the stage is scrolled back to 0).
      this.hooks.scrollTo(0, 'auto'); this.n.tourT0 = null; this.n.tourEnd = false; this.n.cut = false; this.setPh(this.m === 'full' ? 'tour' : 'links'); return;
    }
    const at = (ms: number, ph: Phase) => this.timers.push(setTimeout(() => this.setPh(ph), ms));
    this.setPh('dark');
    this.hooks.scrollTo(0, 'auto');
    if (this.m !== 'full') { at(60, 'ready'); return; }
    TIMES[visit].forEach(x => at(x[0], x[1])); // 'first' ends at 'tour'; 'links' + 'ready' follow the end of the tour (tick → tourDone)
    this.timers.push(setTimeout(() => { try { localStorage.setItem(INTRO_KEY, 'seen'); } catch { /* storage unavailable */ } }, 1500));
  }
  skip() {
    this.clearTimers();
    if (this.mobile) { this.setPh('links'); return; } // the mobile "done" state
    this.setPh('ready'); try { localStorage.setItem(INTRO_KEY, 'seen'); } catch { /* storage unavailable */ }
  }
  ready(): boolean { return ge(this.n.ph, this.mobile ? 'links' : 'ready'); }
  setScroll(topDesignPx: number) { this.n.form = clamp(topDesignPx / this.G.track); }

  // Current positions of the three capitals for the network at progress fk.
  private capPos(): Pt[] { const g = this.g, e = geoE(this.n.fk); return g.caps.map((c, i) => ({ x: c.x + (g.yEnd[i].x - c.x) * e, y: c.y + (g.yEnd[i].y - c.y) * e })); }
  // The map plane: tilted toward the viewer at the geographic state, flat by 80% of the track; the pointer tilts it a little while the map is still a map.
  private tiltOf(): Tilt { const G = this.G, n = this.n, f = n.fk, k = 1 - clamp(f / .3); return { ax: G.tilt * (1 - smooth(clamp(f / .8))) + n.py * 3 * k, ay: n.px * 6 * k }; }
  private tiltCss() { const t = this.tiltOf(); return 'rotateX(' + t.ax.toFixed(2) + 'deg) rotateY(' + t.ay.toFixed(2) + 'deg)'; }
  // Projection of a point of the plane to stage coordinates — the same maths the browser applies (rotateX · rotateY about (ox,oy), perspective P at (ox,oy)). Capitals and names are HTML placed with it, so they stay upright.
  private proj3(p: Pt, t: Tilt, z = 0): Pt {
    const G = this.G, a = t.ax * RAD, b = t.ay * RAD, dx = p.x - G.ox, dy = p.y - G.oy;
    const x2 = dx * Math.cos(b) + z * Math.sin(b), zr = z * Math.cos(b) - dx * Math.sin(b), y2 = dy * Math.cos(a) - zr * Math.sin(a), z2 = dy * Math.sin(a) + zr * Math.cos(a);
    const sc = G.P / (G.P - z2); return { x: G.ox + x2 * sc, y: G.oy + y2 * sc };
  }
  // Where the van is at tour time t (0–1): dwelling at a stop or easing along a leg; position by arc length on the route.
  private vanAt(t: number): VanPos {
    const Rt = this.g.route, S = Rt.stops, last = S.length - 1; let j = 0; while (j < last && t >= S[j + 1].tA) j++;
    let dist: number, moving = false; if (j >= last || t <= S[j].tD) dist = Rt.cum[S[j].i]; else { const u = smooth(clamp((t - S[j].tD) / (S[j + 1].tA - S[j].tD))); dist = Rt.cum[S[j].i] + u * (Rt.cum[S[j + 1].i] - Rt.cum[S[j].i]); moving = true; }
    let lo = 0, hi = Rt.cum.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (Rt.cum[mid] <= dist) lo = mid; else hi = mid; }
    const a = Rt.pts[lo], b = Rt.pts[hi], seg = (Rt.cum[hi] - Rt.cum[lo]) || 1, u = clamp((dist - Rt.cum[lo]) / seg);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dist, dx: b.x - a.x, dy: b.y - a.y, moving };
  }
  // Scrolled back to the top after an interrupted tour: the intro resumes from the van's departure.
  private restartTour() { if (this.mobile) { this.setPh('tour'); return; } this.clearTimers(); this.setPh('tour'); }
  private tourDone() { if (this.mobile) { this.setPh('links'); return; } this.setPh('links'); this.timers.push(setTimeout(() => this.setPh('ready'), 900)); }
  // A connection at progress f: the morph polyline (plane coordinates) lifted as an arc (z = height · sin πt, height → 0 by ARC_END), projected to the stage with the current tilt.
  private edgePts(i: number, f: number, e: number, tl: Tilt): Pt[] { const g = this.g, lift = g.arcH[i] * (1 - smooth(clamp(f / ARC_END))); return lerpPts(g.eGeo[i], g.eY[i], e).map((p, k) => this.proj3(p, tl, lift * Math.sin(Math.PI * k / (N - 1)))); }
  // The connections thicken from 1px to the icon's own stroke between 68% (junction formed) and 92%, so the knot arrives as a stroke, not as a wire that is swapped for a thick icon.
  private lineW(f: number) { return 1 + (STRAND * this.g.skel.sw - 1) * smooth(clamp((f - .68) / .24)); }
  // Over-under at the junction: from 76% the riser strands retract behind the thread (dash trim with round caps), opening the artwork's gap between the stem cut and the thread's lower edge.
  private dashFor(i: number, f: number) {
    if (i === 0 || f < .72) return '100'; const p = smooth(clamp((f - .76) / .16)); if (p <= 0) return '100';
    const g = this.g, w = this.lineW(f), L = g.len[i], full = g.gapPx + w, hid = p * full;
    const start = i === 2 ? g.sStem + g.gapPx + w / 2 - hid : L - g.sStem - g.gapPx - w / 2;
    return (start / L * 100).toFixed(3) + ' ' + (hid / L * 100).toFixed(3) + ' 1000';
  }
  // Reveal mask width: never narrower than the lines (the icon sits under them in the same neon); from 82% it widens past the stroke to 1.5 × by 97%, then the mask is total (the rect).
  private maskW(f: number) { const rv = f < .82 ? 0 : 1 + (1.5 * this.g.skel.sw - 1) * smooth(clamp((f - .82) / .15)); return Math.max(this.lineW(f), rv); }
  // CSS mask for the symbol <img>: the centreline stroked white at width w (alpha mask); total once the reveal is complete.
  private maskUrl(w: number, total: boolean) {
    const g = this.g, b = g.skel.box;
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 " + b.w.toFixed(2) + " " + b.h.toFixed(2) + "'>" + (total
      ? "<rect x='-40' y='-40' width='" + (b.w + 80).toFixed(1) + "' height='" + (b.h + 80).toFixed(1) + "' fill='white'/>"
      : "<path d='" + g.skel.arm + "' fill='none' stroke='white' stroke-width='" + w.toFixed(2) + "' stroke-linecap='butt' stroke-linejoin='round'/><path d='" + g.skel.knot + "' fill='none' stroke='white' stroke-width='" + w.toFixed(2) + "' stroke-linecap='butt' stroke-linejoin='round'/>") + "</svg>";
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  }

  private place() {
    const n = this.n, g = this.g, G = this.G, f = n.fk, e = geoE(f), tl = this.tiltOf();
    if (n.plane) n.plane.style.transform = this.tiltCss();
    const borderOp = clamp(1 - f / .45), clOp = clamp(1 - f / .3), capLab = clamp(1 - (f - .1) / .3), lineFade = clamp(1 - (f - .97) / .03), nodeFade = clamp(1 - (f - .55) / .12), lw = this.lineW(f), solid = clamp((f - .68) / .15);
    const pos = this.capPos(), lit = (i: number) => n.hot === i || n.sel === i;
    const scr = n.scr = pos.map(p => this.proj3(p, tl));
    const endOp = (.5 + .5 * smooth(clamp((f - .2) / .3))).toFixed(3);
    EDGES.forEach(([a, b], i) => {
      const pp = this.edgePts(i, f, e, tl), d = dOf(pp), r = n.edges[i], q = n.pulses[i], gr = n.grads[i];
      if (gr) { gr.setAttribute('x1', pp[0].x.toFixed(1)); gr.setAttribute('y1', pp[0].y.toFixed(1)); gr.setAttribute('x2', pp[N - 1].x.toFixed(1)); gr.setAttribute('y2', pp[N - 1].y.toFixed(1)); }
      (n.gstops[i] || []).forEach(st => st.setAttribute('stop-opacity', endOp));
      if (r) { r.setAttribute('d', d); r.setAttribute('stroke-width', lw.toFixed(2)); r.style.strokeDasharray = this.dashFor(i, f); if (f > .72) r.style.strokeDashoffset = '0'; r.setAttribute('stroke-opacity', ((lit(a) || lit(b) ? 1 : .65 + .35 * solid) * lineFade).toFixed(3)); }
      // The pulses' fade on scroll goes to style.opacity so the phase gate on stroke-opacity (hidden until 'links', review 11–12) and its 400ms transition survive every frame.
      // The prototype's one value is .9 · nodeFade (line 332): the .9 is the gate's stroke-opacity (applyPhase), so only nodeFade goes here — the two multiply.
      if (q) { q.setAttribute('d', d); q.style.opacity = nodeFade.toFixed(3); }
    });
    CAPS.forEach((_c, i) => { const r = n.caps[i]; if (!r) return; const p = scr[i]; if (r.b) { r.b.style.transform = 'translate(' + (p.x - g.caps[i].x).toFixed(1) + 'px,' + (p.y - g.caps[i].y).toFixed(1) + 'px)'; r.b.style.opacity = nodeFade.toFixed(3); r.b.style.visibility = nodeFade > .02 ? 'visible' : 'hidden'; } if (r.t) r.t.style.opacity = capLab.toFixed(3); if (r.k) r.k.style.opacity = capLab.toFixed(3); });
    n.halos.forEach((c, i) => { if (c) { c.setAttribute('cx', pos[i].x.toFixed(1)); c.setAttribute('cy', pos[i].y.toFixed(1)); } });
    if (n.haloG && f > 0) n.haloG.style.opacity = borderOp.toFixed(3);
    n.traces.forEach(t => { if (t && f > 0) t.style.opacity = (TRACE * (1 - smooth(clamp(f / ARC_END)))).toFixed(3); });
    const t = n.tour;
    {
      const v = this.vanAt(t);
      // The live stage: the trail and the towns go once the phase is past the tour ('links'); instant when the tour was cut.
      if (n.trail) { n.trail.style.strokeDashoffset = (100 - 100 * v.dist / g.route.len).toFixed(3); const after = ge(n.ph, 'links') ? 1 : 0; n.trail.style.opacity = (borderOp * (1 - after)).toFixed(3); n.trail.style.transition = n.cut ? 'none' : 'opacity 900ms linear'; }
      // The van: upright, mirrored to face its direction of travel so the thread always trails (review 10); in over the first 1% of the tour, out over the last 1.5%.
      if (n.van) { const q = this.proj3(v, tl), sc = G.vanW / 880; if (v.moving && Math.abs(v.dx) > .4 * Math.hypot(v.dx, v.dy)) n.vanDir = v.dx > 0 ? -1 : 1; const dir = n.vanDir || -1; n.van.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ',' + q.y.toFixed(1) + ') scale(' + (sc * dir).toFixed(4) + ',' + sc.toFixed(4) + ') translate(-440,-392)'); n.van.style.opacity = (t > 0 && t < 1 ? clamp(t / .01) * clamp((1 - t) / .015) : 0).toFixed(3); }
      // Per stop: emphasis `em` decays over EMF of the tour after the van arrives; `ap` = the town appears over 1.2% of the tour around the arrival.
      g.route.stops.forEach(st => {
        const em = (t >= st.tA && t < 1) ? 1 - smooth(clamp((t - st.tA) / EMF)) : 0, ap = clamp((t - st.tA + .012) / .012);
        if (st.cap != null) { const r = n.caps[st.cap]; if (r && r.t) r.t.style.color = (lit(st.cap) || em > .5) ? '#fff' : '#C4C8BB'; return; }
        const w = st.town == null ? undefined : n.towns[st.town]; if (!w || !w.w) return;
        const q = this.proj3(st.p, tl); w.w.style.transform = 'translate(' + (q.x - st.p.x).toFixed(1) + 'px,' + (q.y - st.p.y).toFixed(1) + 'px)'; const stay = ge(n.ph, 'links') ? 0 : 1; w.w.style.opacity = (ap * borderOp * stay).toFixed(3); w.w.style.transition = n.cut ? 'none' : 'opacity 900ms linear';
        if (w.d) w.d.style.transform = 'scale(' + (1 + .8 * em).toFixed(3) + ')';
        if (w.t) { w.t.style.color = em > .5 ? '#fff' : '#9CA096'; w.t.style.transform = 'scale(' + (1 + .25 * em).toFixed(3) + ')'; if (G.townLabels === 'current') w.t.style.opacity = em.toFixed(3); }
      });
    }
    const litCode = n.hot != null ? CAPS[n.hot].code : n.sel != null ? CAPS[n.sel].code : null;
    n.borders.forEach((b, i) => { if (!b) return; b.style.opacity = borderOp.toFixed(3); const on = g.borders[i].code === litCode; b.setAttribute('fill', on ? LAND_LIT : LAND); b.setAttribute('stroke', on ? EDGE_LIT : EDGE); });
    n.dots.forEach((d, i) => { if (!d) return; d.style.opacity = borderOp.toFixed(3); d.setAttribute('fill', 'url(#' + (g.borders[i].code === litCode ? 'dotsl' : 'dots') + ')'); });
    n.clabels.forEach((tx, i) => { if (!tx) return; const q = this.proj3(g.clabels[i], tl); tx.style.transform = 'translate(' + (q.x - g.clabels[i].x).toFixed(1) + 'px,' + (q.y - g.clabels[i].y).toFixed(1) + 'px)'; tx.style.opacity = clOp.toFixed(3); });
    // The icon under the strands from 60%, masked to the strand width (keyed so the data URL is only rebuilt when the width changes); total from 97%.
    if (n.yimg) { const vis = f >= .6; n.yimg.style.opacity = vis ? '1' : '0'; const key = vis ? (f >= .97 ? 'all' : this.maskW(f).toFixed(2)) : 'none'; if (key !== n.maskKey) { n.maskKey = key; if (vis) { const u = this.maskUrl(this.maskW(f), f >= .97); n.yimg.style.webkitMaskImage = u; n.yimg.style.maskImage = u; } } }
    if (n.cue) { const o = clamp(1 - f / .25); n.cue.style.opacity = o.toFixed(3); n.cue.style.visibility = o > .02 ? 'visible' : 'hidden'; }
    if (n.dot) n.dot.style.color = f > .95 ? MAT : '';
    if (n.knot) n.knot.style.visibility = f > .9 ? 'visible' : 'hidden';
    // Reaching 98% draws the connection to the wordmark once per arrival (2.4s); reduced / static show it at rest (.6, fully drawn — the prototype's `still` board state); reset below 90%.
    if (n.ident) {
      if (f >= .98 && !n.identOn) { n.identOn = true; const el = n.ident; el.style.animation = 'none'; void el.getBoundingClientRect(); el.style.animation = this.m === 'full' ? 'cs-ident 2400ms ' + EASE + ' forwards' : 'none'; el.style.opacity = this.m === 'full' ? '' : '.6'; if (this.m !== 'full') el.style.strokeDashoffset = '0'; }
      else if (f < .9 && n.identOn) { n.identOn = false; n.ident.style.animation = 'none'; n.ident.style.opacity = '0'; n.ident.style.strokeDashoffset = '100'; }
    }
  }

  private tick = (now: number) => {
    if (this.dead) return;
    const n = this.n, m = this.m;
    // Eased follow of the scroll target (22% per frame); reduced snaps at 50% of the track, static is fixed at 1.
    if (this.snap) n.fk = m === 'static' ? 1 : (n.form >= .5 ? 1 : 0); else { n.fk += (n.form - n.fk) * .22; if (Math.abs(n.form - n.fk) < .0015) n.fk = n.form; }
    if (n.torch && m === 'full') {
      // The pointer lamp: a soft spring (k .06, damping .62) toward the pointer; the radius breathes ±2.5% (≈7s) and grows up to 35% with the pointer's speed (reviews 16–18).
      if (n.ptr) {
        if (n.lx == null || n.ly == null) { n.lx = n.ptr.x; n.ly = n.ptr.y; n.vx = 0; n.vy = 0; }
        const k = .06, c = .62; n.vx = (n.vx + (n.ptr.x - n.lx) * k) * c; n.vy = (n.vy + (n.ptr.y - n.ly) * k) * c; n.lx += n.vx; n.ly += n.vy;
        const sp = Math.hypot(n.vx, n.vy), br = 1 + Math.min(.35, sp * .02), rr = this.G.torch * (1 + .025 * Math.sin(now / 1100)) * br, ex = n.lx.toFixed(1), ey = n.ly.toFixed(1);
        n.torch.setAttribute('cx', ex); n.torch.setAttribute('cy', ey); n.torch.setAttribute('r', rr.toFixed(1)); if (n.torchC) { n.torchC.setAttribute('cx', ex); n.torchC.setAttribute('cy', ey); n.torchC.setAttribute('r', (rr * .38).toFixed(1)); }
        if (n.torchC) n.torchC.setAttribute('r', (rr * .42).toFixed(1)); // the prototype's second write wins: the core is .42 × the lamp
      }
      else { n.lx = null; }
      // Lamp fade: in 500ms / out 900ms on the one easing.
      if (n.torchG) { const want = n.ptr ? 1 : 0; if (want !== n.torchOn) { n.torchOn = want; n.torchG.style.transition = want ? 'opacity 500ms ' + EASE : 'opacity 900ms ' + EASE; n.torchG.style.opacity = String(want); } }
    }
    let par = false;
    // Parallax follow of the pointer (8% per frame), full motion only.
    if (m === 'full') { const px = n.px + (n.tx - n.px) * .08, py = n.py + (n.ty - n.py) * .08; if (Math.abs(px - n.px) > .0004 || Math.abs(py - n.py) > .0004) { n.px = px; n.py = py; par = true; } }
    // The live tour clock: during 'tour' the van's time runs from the rAF clock; any scroll cuts it (the end state appears instantly); back at the top the tour restarts.
    if (m !== 'full') n.tour = 1;
    else if (n.ph === 'tour') {
      if (n.form > .002) { n.tour = 1; n.tourT0 = null; n.cut = true; n.tourEnd = true; this.tourDone(); }
      else { if (!n.tourT0) n.tourT0 = now; n.tour = clamp((now - n.tourT0) / this.tourMs); if (n.tour >= 1 && !n.tourEnd) { n.tourEnd = true; this.tourDone(); } }
    }
    else { n.tour = ge(n.ph, 'links') ? 1 : 0; n.tourT0 = null; n.tourEnd = false; if (n.cut && n.form <= .002 && n.fk <= .002) { n.cut = false; this.restartTour(); } }
    if (n.fk !== n.lastFk || n.dirty || par || n.tour !== n.lastTour) { this.place(); n.lastFk = n.fk; n.lastTour = n.tour; n.dirty = false; }
    this.raf = requestAnimationFrame(this.tick);
  };

  // The network SVG on the tilted map plane — dot-matrix land, borders, the van's trail, the capital halos, the ground traces; the connections, pulses, van and the
  // connection to the wordmark in a stage-space overlay; the device matrix as a page ground. Built once per mount; capitals and country names are HTML (page) placed by proj3 so they stay upright.
  private net(stage: HTMLElement, ground: HTMLElement) {
    const n = this.n, m = this.m, G = this.G, g = this.g, on = (k: Phase) => this.on(k);
    const e = geoE(n.fk), tl = this.tiltOf(), litCode = n.hot != null ? CAPS[n.hot].code : n.sel != null ? CAPS[n.sel].code : null;
    // Land fill = a matrix of tiny device glyphs (review 12 — the dots become tech icons): one pattern cell holds the 16 glyphs on a 4 × 4 grid of P × P, 0.5px strokes.
    // cell P = 3.6 × pitch (21.6px desktop), glyph 1.65 × pitch (9.9px desktop / 8.25 mobile) on a 16-unit box: light enough to read as a texture, sharp enough to read as devices up close.
    const P = G.pitch * 3.6, GL = G.pitch * 1.65;
    const pat = (pid: string, col: string) => sv('pattern', { id: pid, patternUnits: 'userSpaceOnUse', width: P * 4, height: P * 4, 'shape-rendering': 'geometricPrecision' }, null,
      DEVICES.map((d, k) => sv('g', { transform: 'translate(' + ((k % 4) * P + (P - GL) / 2).toFixed(2) + ',' + (Math.floor(k / 4) * P + (P - GL) / 2).toFixed(2) + ') scale(' + (GL / 16).toFixed(4) + ')', fill: 'none', stroke: col, 'stroke-width': .5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, null,
        d.map(dd => sv('path', { d: dd, 'vector-effect': 'non-scaling-stroke' })))));
    const kids: Element[] = [], ovKids: Element[] = [];
    n.torch = sv('circle', { cx: -1000, cy: -1000, r: G.torch, fill: 'url(#torch)' });
    n.torchC = sv('circle', { cx: -1000, cy: -1000, r: G.torch * .38, fill: 'url(#torchc)' });
    n.tm = sv('mask', { id: 'tm', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: G.W, height: G.H }, null, [n.torch]);
    n.tmc = sv('mask', { id: 'tmc', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: G.W, height: G.H }, null, [n.torchC]);
    n.halos = CAPS.map((_c, i) => sv('circle', { cx: g.caps[i].x, cy: g.caps[i].y, r: G.halo, fill: 'url(#halo)' }));
    kids.push(sv('defs', null, null, [pat('dots', DOT), pat('dotsl', DOT_LIT), pat('dotsbg', DOT_BG), pat('dotsbgl', DOT_BG_LIT), pat('dotsbgc', DOT_BG_CORE),
      // lamp falloff (inverse-square-ish: 1 → .55 → .22 → .06 → 0) and a tight core
      sv('radialGradient', { id: 'torch' }, null, [1, .82, .62, .44, .29, .18, .1, .05, .02, 0].map((o, k) => sv('stop', { offset: (k / 9).toFixed(3), 'stop-color': '#fff', 'stop-opacity': o }))),
      sv('radialGradient', { id: 'torchc' }, null, [1, .78, .52, .3, .14, .05, 0].map((o, k) => sv('stop', { offset: (k / 6).toFixed(3), 'stop-color': '#fff', 'stop-opacity': o }))),
      n.tm, n.tmc,
      sv('radialGradient', { id: 'halo' }, null, [sv('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': 1 }), sv('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': 0 })]),
      sv('mask', { id: 'hm', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: G.W, height: G.H }, null, n.halos)]));
    // Borders: 2px EDGE (review 14 "bolder borders"), drawn on 'map' (1200ms, 150ms apart), the hovered / pinned capital lifts its country; pointer-events auto so elementFromPoint finds data-country.
    g.borders.forEach((b, i) => { const lit = b.code === litCode; const p = sv('path', { 'data-country': b.code, d: b.d, fill: lit ? LAND_LIT : LAND, 'fill-opacity': on('map') ? 1 : 0, stroke: lit ? EDGE_LIT : EDGE, 'stroke-width': 2, 'stroke-linejoin': 'round', pathLength: 100 },
      { pointerEvents: 'auto', strokeDasharray: '100', strokeDashoffset: on('map') ? '0' : '100', transition: tr(m, 'stroke-dashoffset 1200ms ' + EASE + ' ' + (150 * i) + 'ms, fill-opacity 900ms linear ' + (600 + 150 * i) + 'ms, fill 240ms linear, stroke 240ms linear', 'fill-opacity 200ms linear, fill 200ms linear, stroke 200ms linear') }); n.borders[i] = p; kids.push(p); });
    g.borders.forEach((b, i) => { const p = sv('path', { d: b.d, fill: 'url(#' + (b.code === litCode ? 'dotsl' : 'dots') + ')', 'fill-opacity': on('map') ? 1 : 0 }, { pointerEvents: 'none', transition: tr(m, 'fill-opacity 900ms linear ' + (800 + 150 * i) + 'ms', 'fill-opacity 200ms linear') }); n.dots[i] = p; kids.push(p); });
    // The van's trail: the whole route at 35%, revealed behind the van by arc length (pathLength 100 ↔ the cum table); it stays as the network and fades with the land on scroll.
    // Static has no map (progress fixed at 1 → borderOp 0), so its trail is born at 0: place()'s first write sets opacity 0 and the 900ms transition together, which would otherwise fade the whole route over the brand composition.
    n.trail = sv('path', { d: g.route.d, fill: 'none', stroke: MAT, 'stroke-width': 1, 'stroke-opacity': .35, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 100 }, { strokeDasharray: '100', strokeDashoffset: '100', opacity: m === 'static' ? '0' : '1' }); kids.push(n.trail);
    // The matrix lights around each capital (brighter dots through a radial mask that follows the node) — no blur, no glow.
    n.haloG = sv('g', { mask: 'url(#hm)' }, { opacity: on('caps') ? '1' : '0', transition: tr(m, 'opacity 900ms linear 200ms', 'opacity 200ms linear') }, g.borders.map(b => sv('path', { d: b.d, fill: 'url(#dotsl)' }))); kids.push(n.haloG);
    // Ground traces: the arcs' footprints on the land, drawn with them and gone once the arcs have settled.
    const quick = n.cut ? 'none' : null;
    EDGES.forEach((_ed, i) => { const p = sv('path', { d: g.traceD[i], fill: 'none', stroke: MAT, 'stroke-width': 1, pathLength: 100 }, { opacity: String(TRACE), strokeDasharray: '100', strokeDashoffset: on('links') ? '0' : '100', transition: quick || tr(m, 'stroke-dashoffset 520ms ' + EASE + ' ' + (160 * i) + 'ms') }); n.traces[i] = p; kids.push(p); });
    // Apex-bright gradient along each arc (end stops brighten to uniform as the arcs settle).
    ovKids.push(sv('defs', null, null, EDGES.map((_ed, i) => { const pp = this.edgePts(i, n.fk, e, tl); const s0 = sv('stop', { offset: '0', 'stop-color': MAT, 'stop-opacity': .5 }), s1 = sv('stop', { offset: '1', 'stop-color': MAT, 'stop-opacity': .5 }); n.gstops[i] = [s0, s1];
      return n.grads[i] = sv('linearGradient', { id: 'ag' + i, gradientUnits: 'userSpaceOnUse', x1: pp[0].x, y1: pp[0].y, x2: pp[N - 1].x, y2: pp[N - 1].y }, null, [s0, sv('stop', { offset: '.5', 'stop-color': MAT, 'stop-opacity': 1 }), s1]); })));
    EDGES.forEach((_ed, i) => { const p = sv('path', { d: dOf(this.edgePts(i, n.fk, e, tl)), fill: 'none', stroke: 'url(#ag' + i + ')', 'stroke-width': this.lineW(n.fk), 'stroke-opacity': .65, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 100 }, { strokeDasharray: this.dashFor(i, n.fk), strokeDashoffset: on('links') ? '0' : '100', transition: quick || tr(m, 'stroke-dashoffset 520ms ' + EASE + ' ' + (160 * i) + 'ms') }); n.edges[i] = p; ovKids.push(p); });
    // Three 2px flow pulses (3% dash, 4.8s loop, 1.6s apart) travel the connections — full motion only; they appear with the links (400ms, 600ms after the draw).
    if (m === 'full') EDGES.forEach((_ed, i) => { const p = sv('path', { d: dOf(this.edgePts(i, n.fk, e, tl)), fill: 'none', stroke: MAT, 'stroke-width': 2, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': '3 97', 'stroke-dashoffset': 100, 'stroke-opacity': on('links') ? .9 : 0 }, { animation: 'cs-flow 4.8s linear ' + (1.6 * i) + 's infinite', transition: quick || 'stroke-opacity 400ms linear 600ms' }); n.pulses[i] = p; ovKids.push(p); });
    // The van, Screen 08 livery at sticker size: black body with a neon edge, the official knot large on the side panel with its thread running to the rear, dark glass, neon-rimmed wheels. Clip + knot sit in <defs> (a clipPath inside a transformed group would not apply).
    ovKids.push(sv('defs', null, null, [sv('clipPath', { id: 'vc' }, null, [sv('path', { d: VAN_BODY })])]));
    n.van = sv('g', null, { opacity: '0' }, [
      sv('g', { 'clip-path': 'url(#vc)' }, null, [
        sv('rect', { x: 0, y: 0, width: 880, height: 390, fill: '#000' }),
        sv('path', { d: VAN_BODY, fill: 'none', stroke: MAT, 'stroke-width': 16 }),
        // the knot: icon artboard scaled to .385 (stem foot ≈ y 340), its thread continued to the rear edge at the artwork's own stroke
        sv('g', null, null, [sv('path', { d: 'M815 210 L900 210', fill: 'none', stroke: MAT, 'stroke-width': 42, 'stroke-linecap': 'butt' }), sv('g', { transform: 'translate(400,-5) scale(.385)' }, null, [sv('path', { d: KNOT_D, fill: MAT })])]),
        sv('polygon', { points: '110,150 206,44 232,40 148,150', fill: '#3A3D36' }), sv('polygon', { points: '172,148 248,44 336,44 336,148', fill: '#3A3D36' }),
        sv('rect', { x: 0, y: 262, width: 880, height: 60, fill: '#1A1A1A' }),
        sv('rect', { x: 0, y: 176, width: 18, height: 54, rx: 5, fill: '#fff' })]),
      sv('circle', { cx: 165, cy: 334, r: 50, fill: '#000', stroke: MAT, 'stroke-width': 18 }), sv('circle', { cx: 165, cy: 334, r: 16, fill: MAT }),
      sv('circle', { cx: 705, cy: 334, r: 50, fill: '#000', stroke: MAT, 'stroke-width': 18 }), sv('circle', { cx: 705, cy: 334, r: 16, fill: MAT })]);
    ovKids.push(n.van);
    // The connection from the knot to the wordmark (desktop only), drawn once the icon is complete.
    if (g.identD) { n.ident = sv('path', { d: g.identD, fill: 'none', stroke: MAT, 'stroke-width': 1, pathLength: 100 }, { strokeDasharray: '100', strokeDashoffset: '100', opacity: '0' }); ovKids.push(n.ident); }
    const svgStyle: Style = { position: 'absolute', left: '0', top: '0', overflow: 'visible', pointerEvents: 'none', display: 'block' };
    const svg = sv('svg', { 'aria-hidden': 'true', width: G.W, height: G.H, viewBox: '0 0 ' + G.W + ' ' + G.H }, svgStyle, kids);
    // The connections live in a stage-space overlay (not in the tilted plane): their points are projected per frame with the plane's tilt and their own elevation.
    n.ov = sv('svg', { 'aria-hidden': 'true', width: G.W, height: G.H, viewBox: '0 0 ' + G.W + ' ' + G.H }, svgStyle, ovKids);
    // Page ground: the device matrix over the whole stage, almost invisible — it only reads up close (review 15: a very slight blur); the lamp = two brighter copies through the torch masks.
    const bgRect = sv('rect', { x: 0, y: 0, width: G.W, height: G.H, fill: 'url(#dotsbg)' });
    const litRect = sv('rect', { x: 0, y: 0, width: G.W, height: G.H, fill: 'url(#dotsbgl)', mask: 'url(#tm)' }), coreRect = sv('rect', { x: 0, y: 0, width: G.W, height: G.H, fill: 'url(#dotsbgc)', mask: 'url(#tmc)' });
    n.torchG = sv('g', null, { opacity: '0', transition: 'opacity 500ms ' + EASE }, [litRect, coreRect]);
    n.bgRects = [bgRect, litRect, coreRect];
    n.bg = sv('svg', { 'aria-hidden': 'true', width: G.W, height: G.H, viewBox: '0 0 ' + G.W + ' ' + G.H }, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', display: 'block', filter: 'blur(.6px)', opacity: on('map') ? '1' : '0', transition: tr(m, 'opacity 1200ms linear', 'opacity 200ms linear') }, [bgRect, n.torchG]);
    // The plane: rotateX · rotateY about the map centre, answered by the browser's perspective set on the stage.
    n.plane = document.createElement('div');
    Object.assign(n.plane.style, { position: 'absolute', left: '0', top: '0', width: G.W + 'px', height: G.H + 'px', transformOrigin: G.ox + 'px ' + G.oy + 'px 0px', transform: this.tiltCss(), transition: tr(m, 'none', 'transform 200ms linear'), pointerEvents: 'none', willChange: 'transform' } satisfies Style);
    n.plane.appendChild(svg);
    ground.appendChild(n.bg);
    stage.prepend(n.plane, n.ov);
  }

  /** What a React re-render re-applied after a phase change: every attribute / style that depends on `on(k)`, the motion and `cut`; then place() runs on the next frame. */
  private applyPhase() {
    const n = this.n, m = this.m, on = (k: Phase) => this.on(k), quick = n.cut ? 'none' : null;
    if (n.bg) n.bg.style.opacity = on('map') ? '1' : '0';
    n.borders.forEach(b => { b.setAttribute('fill-opacity', on('map') ? '1' : '0'); b.style.strokeDashoffset = on('map') ? '0' : '100'; });
    n.dots.forEach(d => d.setAttribute('fill-opacity', on('map') ? '1' : '0'));
    if (n.haloG) n.haloG.style.opacity = on('caps') ? '1' : '0';
    n.traces.forEach((t, i) => { t.style.strokeDashoffset = on('links') ? '0' : '100'; t.style.transition = quick || tr(m, 'stroke-dashoffset 520ms ' + EASE + ' ' + (160 * i) + 'ms'); });
    n.edges.forEach((r, i) => { r.style.strokeDashoffset = on('links') ? '0' : '100'; r.style.transition = quick || tr(m, 'stroke-dashoffset 520ms ' + EASE + ' ' + (160 * i) + 'ms'); });
    n.pulses.forEach((q, i) => { q.setAttribute('stroke-opacity', on('links') ? '.9' : '0'); q.style.animation = 'cs-flow 4.8s linear ' + (1.6 * i) + 's infinite'; q.style.transition = quick || 'stroke-opacity 400ms linear 600ms'; });
    n.dirty = true;
  }

  bind(b: StageBindings) { const n = this.n; n.caps = b.caps; n.towns = b.towns; n.clabels = b.clabels; n.cue = b.cue; n.knot = b.knot; n.yimg = b.yimg; n.dot = b.dot; n.maskKey = null; n.dirty = true; }

  /** Mouse / pen only — the page drops touch pointers (the finger is touchLamp's). Desktop (full motion only — the page listens only then): parallax target, lamp pointer, and the hover hit-test — the nearest projected capital within G.hit, else the country under the pointer (data-country) — while the map is still a map (fk ≤ .6). Mobile: the lamp pointer only. */
  pointerMove(x: number, y: number, clientX: number, clientY: number) {
    const n = this.n, G = this.G;
    if (this.mobile) { n.ptr = { x, y }; return; }
    if (this.m !== 'full') return;
    n.tx = clamp(x / G.W) * 2 - 1; n.ty = clamp(y / G.H) * 2 - 1; n.ptr = { x, y };
    const pos = n.scr || this.capPos(); if (n.fk > .6) { this.setHot(null); return; }
    let best: number | null = null, bd = G.hit;
    for (let i = 0; i < pos.length; i++) { const d = Math.hypot(pos[i].x - x, pos[i].y - y); if (d < bd) { bd = d; best = i; } }
    if (best == null) { const el = document.elementFromPoint(clientX, clientY); const code = el && el.getAttribute('data-country'); if (code) best = CAPS.findIndex(k => k.code === code); if (best != null && best < 0) best = null; }
    this.setHot(best);
  }
  /** The mouse / pen left the stage (frame().onLeave 477 / mframe().onLeave 515): the lamp goes out — unless a finger holds it (touchLamp); desktop also levels the plane and clears the hover. */
  pointerLeave() { const n = this.n; if (this.mobile) { if (!n.touch) n.ptr = null; return; } if (!n.touch) { n.tx = 0; n.ty = 0; n.ptr = null; } this.setHot(null); }
  setHot(i: number | null) { const n = this.n; if (n.hot === i) return; n.hot = i; n.dirty = true; this.hooks.onHot(i); }
  togglePick(i: number) { const n = this.n; n.sel = n.sel === i ? null : i; n.dirty = true; this.hooks.onSel(n.sel); }

  /**
   * The finger lamp (prototype touchLamp, lines 301–310 — both canvases, review of 2026-10-16): native passive touch listeners on the stage. Unlike pointer
   * events they keep firing while the frame scrolls (a pan fires pointercancel the moment it starts, which would put the light out — so the page ignores
   * touch pointers altogether). The light follows the finger, holds 1200ms after it lifts, then fades (900ms, in the rAF loop); on the desktop canvas the
   * finger also drives the plane tilt. Full motion only in effect: tick() renders the lamp and the parallax only then.
   */
  private touchLamp(el: HTMLElement) {
    const n = this.n, G = this.G, tilt = !this.mobile;
    const at = (t: Touch): Pt => { const r = el.getBoundingClientRect(), sc = r.width / G.W || 1; return { x: (t.clientX - r.left) / sc, y: (t.clientY - r.top) / sc }; };
    const on = (e: TouchEvent) => { const t = e.touches[0]; if (!t) return; clearTimeout(n.lift); const p = at(t); n.ptr = p; n.touch = true; if (tilt) { n.tx = clamp(p.x / G.W) * 2 - 1; n.ty = clamp(p.y / G.H) * 2 - 1; } };
    const off = (e: TouchEvent) => { if (e.touches.length) return; clearTimeout(n.lift); n.lift = setTimeout(() => { n.ptr = null; n.touch = false; if (tilt) { n.tx = 0; n.ty = 0; } }, 1200); };
    const opts: AddEventListenerOptions = { passive: true };
    el.addEventListener('touchstart', on, opts); el.addEventListener('touchmove', on, opts); el.addEventListener('touchend', off, opts); el.addEventListener('touchcancel', off, opts);
    this.untouch = () => { el.removeEventListener('touchstart', on); el.removeEventListener('touchmove', on); el.removeEventListener('touchend', off); el.removeEventListener('touchcancel', off); };
  }

  /** Extend the page ground by (padX, padY) design px so the texture continues under the letterbox: the SVG, its rects and the two lamp masks grow around the same origin (the patterns are userSpaceOnUse, so the matrix tiles on without a seam). */
  setPad(padX: number, padY: number) {
    const n = this.n, G = this.G; if (!n.bg) return;
    const W = G.W + 2 * padX, H = G.H + 2 * padY;
    n.bg.style.left = -padX + 'px'; n.bg.style.top = -padY + 'px'; n.bg.setAttribute('width', String(W)); n.bg.setAttribute('height', String(H)); n.bg.setAttribute('viewBox', -padX + ' ' + -padY + ' ' + W + ' ' + H);
    const box = (el: SVGElement | null) => { if (!el) return; el.setAttribute('x', String(-padX)); el.setAttribute('y', String(-padY)); el.setAttribute('width', String(W)); el.setAttribute('height', String(H)); };
    n.bgRects.forEach(box); box(n.tm); box(n.tmc);
  }

  destroy() {
    this.dead = true; cancelAnimationFrame(this.raf); this.clearTimers(); clearTimeout(this.n.lift); if (this.untouch) { this.untouch(); this.untouch = null; }
    const n = this.n; if (n.bg) n.bg.remove(); if (n.plane) n.plane.remove(); if (n.ov) n.ov.remove(); n.bg = null; n.plane = null; n.ov = null;
  }
}
