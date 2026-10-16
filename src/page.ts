// The HTML composition — a 1:1 port of the approved design's desktop template (NYJA-ComingSoon-Desktop-v1.1.dc.html lines 36–72, the live player 29a)
// and mobile template (lines 82–104, 29h1), the view-models frame() / mframe() (432–512), cueNode() (514–518) and townVals() (519–523),
// plus scale-to-fit around the fixed-size stage. The Stage (./stage) owns the SVG network and writes positions / opacities every frame;
// this file owns everything that is HTML: the reveals, the capital interaction styles, the cue / knot / skip / replay buttons, badges, form, footer.
import { CAPS, EASE, MAT, PH, type Canvas, type Phase } from './config';
import { tr } from './math';
import { Stage } from './stage';
import { h, mountForm } from './form';
import type { Geometry, MountOptions, PageApi, StageApi, StageHooks, TownRefs } from './types';

/** p at or past k in the phase order (prototype line 205). */
const ge = (p: Phase, k: Phase) => PH.indexOf(p) >= PH.indexOf(k);
const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (tag: string, attrs: Record<string, string>): SVGElement => { const e = document.createElementNS(SVG_NS, tag); for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]); return e; };
/** VITE_SUBSCRIBE_URL at build time; unset → the form simulates and the privacy line says so. */
const subscribeUrl = (): string | undefined => { const v: unknown = import.meta.env.VITE_SUBSCRIBE_URL; return typeof v === 'string' && v.length > 0 ? v : undefined; };

/** Stand-in when the geo data failed: the composition renders at rest ('ready') and every call is a no-op — nothing throws. */
class NullStage implements StageApi {
  readonly phase: Phase = 'ready'; readonly progress = 1; readonly target = 1; readonly hot = null; readonly sel = null; readonly cut = false; readonly tour = 1;
  bind() {} play() {} skip() {} ready() { return true; } setScroll() {} pointerMove() {} pointerLeave() {} setHot() {} togglePick() {} setPad() {} destroy() {}
}

interface CapEls { block: HTMLElement; inner: HTMLElement; ring: HTMLElement; node: HTMLElement; btn: HTMLButtonElement; lab: HTMLElement; coord: HTMLElement | null }
interface Reveal { el: HTMLElement; k: Phase; d: number; tf: boolean }

export function mountPage(root: HTMLElement, G: Canvas, g: Geometry | null, opts: MountOptions): PageApi {
  const { motion, mobile } = opts;
  const full = motion === 'full';
  const W = G.W, H = G.H;
  const endpoint = subscribeUrl();
  const ids = { title: 'cs-title-' + G.key, email: 'cs-email-' + G.key, privacy: 'cs-privacy-' + G.key }; // line 477
  let s = 1;
  let hot: number | null = null, sel: number | null = null;

  // ---- The scroll container and the scale-to-fit box (spec "Runtime architecture") ----
  const frame = h('div', { class: 'cs-frame cs-frame--' + G.key });
  const track = h('div', { class: 'cs-track' });
  const fit = h('div', { class: 'cs-fit' });
  const scaled = h('div', { class: 'cs-scaled', style: 'width:' + W + 'px;height:' + H + 'px' });
  const ground = h('div', { class: 'cs-ground' });
  // CSS perspective at the map centre (line 41 / 84) — the Stage tilts its plane inside this clipped box
  const stageEl = h('div', { class: 'cs-stage', style: 'perspective:' + G.P + 'px;perspective-origin:' + G.ox + 'px ' + G.oy + 'px' });
  scaled.append(ground, stageEl); fit.append(scaled); track.append(fit); frame.append(track);
  const scrollTo = (top: number, behavior: 'smooth' | 'auto') => frame.scrollTo({ top: top * s, behavior });
  const tie = () => scrollTo(G.track, full ? 'smooth' : 'auto');   // the cue: to the brand state (line 474 / 508)
  const release = () => scrollTo(0, full ? 'smooth' : 'auto');     // the knot / Esc: back to the geography (line 475)

  // ---- HTML composition: built first, appended to the stage AFTER the Stage's SVGs ----
  // the official icon, revealed by the Stage through a CSS mask (line 43 / 86)
  const yimg = h('img', { class: 'cs-yimg', src: '/brand/nyja-icon-neon.svg', alt: '', 'aria-hidden': 'true', style: 'left:' + G.ybox.x + 'px;top:' + G.ybox.y + 'px;width:' + G.ybox.w + 'px' });
  if (!g) yimg.style.opacity = '1'; // no map to morph from: the icon whole, at rest (the static composition of board H1)
  const logo = h('a', { href: '#', class: 'cs-logo', 'aria-label': 'NYJA' }, h('img', { src: '/brand/logo-dark-ui.png', alt: 'NYJA' }));
  // COMING SOON with its beacon — breathing only in full motion on desktop (line 466); the mobile node is still (line 88)
  const beacon = h('span', { class: 'cs-beacon', 'aria-hidden': 'true', style: full && !mobile ? 'animation:cs-breathe 6s ease-in-out infinite' : null });
  const soon = h('div', { class: 'cs-soon' }, beacon, h('span', null, 'Coming soon'));
  // Kalo hyrjen → (line 45): desktop only, shown while motion is full and the intro is not yet 'ready' (line 465)
  let skip: HTMLButtonElement | null = null;
  if (!mobile) {
    const arrow = svg('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    arrow.append(svg('path', { d: 'M5 12h14' }), svg('path', { d: 'm12 5 7 7-7 7' }));
    skip = h('button', { type: 'button', class: 'cs-skip' }, 'Kalo hyrjen', arrow);
  }
  // country names (line 47 / 473): 0×0 anchors the Stage translates per frame; the inner span carries the reveal
  const clOuter: HTMLElement[] = [], clInner: HTMLElement[] = [];
  if (g && G.clabels) for (const c of g.clabels) {
    const t = h('span', { class: 'cs-cl-t' }, c.label);
    clInner.push(t);
    clOuter.push(h('span', { class: 'cs-cl', 'aria-hidden': 'true', style: 'left:' + c.x + 'px;top:' + c.y + 'px' }, t));
  }
  // the three capitals (line 48 / 89, view-model line 470 / 505): 44×44 block at caps − 22, ring, node, hit button, label (+ coordinates on desktop)
  const caps: CapEls[] = g ? CAPS.map((k, i) => {
    const p = g.caps[i], L = k.side === 'left';
    const side = 'left:' + (L ? 'auto' : '38px') + ';right:' + (L ? '38px' : 'auto') + ';text-align:' + (L ? 'right' : 'left');
    const ring = h('span', { class: 'cs-cap-ring', 'aria-hidden': 'true', style: 'opacity:0' });
    const node = h('span', { class: 'cs-cap-node', 'aria-hidden': 'true', style: 'background:#000;transform:scale(1)' });
    const btn = h('button', { type: 'button', class: 'cs-cap-btn', 'aria-label': k.name + ', ' + k.country, 'aria-pressed': 'false' });
    // label colour is written by the Stage every frame (lit / tour emphasis) — only the initial value here
    const lab = h('span', { class: 'cs-cap-lab', style: side + ';color:#C4C8BB' }, k.label);
    const coord = G.clabels ? h('span', { class: 'cs-cap-coord', style: side + ';color:#73776D' }, k.coord) : null;
    const inner = h('div', { class: 'cs-cap-in' }, ring, node, btn, lab, coord);
    const block = h('div', { class: 'cs-cap', style: 'left:' + (p.x - 22) + 'px;top:' + (p.y - 22) + 'px' }, inner);
    return { block, inner, ring, node, btn, lab, coord };
  }) : [];
  // the tour's towns (line 49 / 90, townVals() 519–523): 0×0 wrapper at the town, 5px dot, label placed by side — r/l beside, a/b centred above/below
  const towns: TownRefs[] = g ? g.route.towns.map(st => {
    const sd = st.side, cen = sd === 'a' || sd === 'b';
    const d = h('span', { class: 'cs-town-dot' });
    const t = h('span', { class: 'cs-town-t', style:
      'top:' + (sd === 'a' ? '-19px' : sd === 'b' ? '6px' : '-6px') +
      ';left:' + (sd === 'r' ? '9px' : cen ? '-70px' : 'auto') +
      ';right:' + (sd === 'l' ? '9px' : cen ? '-70px' : 'auto') +
      ';text-align:' + (sd === 'r' ? 'left' : sd === 'l' ? 'right' : 'center') +
      ';transform-origin:' + (sd === 'r' ? 'left center' : sd === 'l' ? 'right center' : 'center') }, st.label);
    const w = h('span', { class: 'cs-town', 'aria-hidden': 'true', style: 'left:' + st.p.x + 'px;top:' + st.p.y + 'px' }, d, t);
    return { w, d, t };
  }) : [];
  // the scroll cue (line 50 / 94, cueNode() 514–518): the pill with the rising node — still at mid-height when motion is not full.
  // The wrapper carries the r5 reveal; the Stage owns the button's opacity / visibility from the scroll.
  const cueNode = h('span', { class: 'cs-cue-node', style: full ? 'top:27px;animation:cs-scroll 1.8s ' + EASE + ' infinite' : 'top:17px' });
  const cueBtn = h('button', { type: 'button', class: 'cs-cue', 'aria-label': 'Lëviz poshtë për të lidhur' },
    h('span', { class: 'cs-cue-pill', 'aria-hidden': 'true' }, cueNode), h('span', null, 'Lëviz për të lidhur'));
  const cueWrap = h('div', { class: 'cs-cue-wrap' }, cueBtn);
  // the invisible knot button (line 51 / 91): 44×44 at the loop centre, shown by the Stage from 90%
  const knotBtn = g ? h('button', { type: 'button', class: 'cs-knot', 'aria-label': 'NYJA — lidhja është formuar. Shtyp për ta hapur përsëri.', style: 'left:' + (g.yK.x - 22) + 'px;top:' + (g.yK.y - 22) + 'px' }) : null;
  // the statement (line 52 / 92) — the period is the `dot` binding the Stage colours in material from 95%
  const dot = h('span', { class: 'cs-h1-dot' }, '.');
  if (!g) dot.style.color = MAT; // brand state at rest
  const h1 = h('h1', { class: 'cs-h1' }, 'Gjithçka', h('br'), 'Lidhet', dot);
  const badges = buildBadges();
  // privacy line (line 67 / 102) — the simulation note only when no endpoint is configured
  const privacyP = () => h('p', { id: ids.privacy, class: 'cs-form-privacy' }, 'Emaili përdoret vetëm për njoftimin e lansimit. ',
    endpoint ? null : h('span', { class: 'cs-form-note' }, 'Prototip UI/UX — asnjë email nuk regjistrohet.'));
  const stateHost = h('div', { class: 'cs-form-state' });
  const formHead = () => [h('h2', { id: ids.title, class: 'cs-form-h2' }, 'Bëhu i pari që lidhet.'), h('p', { class: 'cs-form-p' }, 'Regjistro emailin dhe mëso i pari kur NYJA të jetë gati.')];
  // desktop: the section inside the stage (line 54–68); mobile: the same section in flow below the track (line 97–103) + the small footer (104)
  const formSection = mobile ? null : h('section', { class: 'cs-form', 'aria-labelledby': ids.title }, ...formHead(), stateHost, privacyP());
  const replay = h('button', { type: 'button', class: 'cs-replay' }, 'Luaje hyrjen përsëri');
  const footer = mobile ? null : h('footer', { class: 'cs-footer' },
    h('div', { class: 'cs-footer-g' }, h('span', null, '© 2026 NYJA'), replay),
    h('div', { class: 'cs-footer-g' }, h('a', { href: '#' }, 'Privatësia'), h('span', { class: 'cs-lang' }, h('span', { class: 'cs-lang-on' }, 'SQ'), h('span', null, '·'), h('a', { href: '#' }, 'EN'))));
  let below: HTMLElement | null = null, belowBox: HTMLElement | null = null;
  if (mobile) {
    below = h('div', { class: 'cs-below' },
      h('section', { class: 'cs-below-form', 'aria-labelledby': ids.title }, ...formHead(), stateHost, privacyP()),
      h('footer', { class: 'cs-below-footer' }, h('span', null, '© 2026 NYJA'), h('span', null, 'Privatësia · SQ · EN')));
    belowBox = h('div', { class: 'cs-below-box' }, below);
    frame.append(belowBox);
  }

  // ---- Reveals (frame() line 442 / 467): rv(on, d) → opacity, translateY(12px) and a 560ms transition (reduced: 200ms fade; static: none) ----
  const rvT = (d: number) => tr(motion, 'opacity 560ms ' + EASE + ' ' + d + 'ms, transform 560ms ' + EASE + ' ' + d + 'ms', 'opacity 200ms linear');
  const reveals: Reveal[] = mobile ? [] : [
    { el: logo, k: 'map', d: 0, tf: false },                            // r0
    { el: h1, k: 'caps', d: 0, tf: true },                              // r1
    { el: badges.nav, k: 'links', d: 200, tf: true },                   // r3
    ...(formSection ? [{ el: formSection, k: 'links' as Phase, d: 200, tf: true }] : []), // r3
    ...(footer ? [{ el: footer, k: 'links' as Phase, d: 200, tf: false }] : []),          // r3
    { el: soon, k: 'map', d: 300, tf: false },                          // r4
    { el: cueWrap, k: 'ready', d: 0, tf: false },                       // r5
  ];
  for (const r of reveals) r.el.style.transition = rvT(r.d);
  // netOp — the capital blocks' inner wrapper (line 468) · clOp — the country names (line 473); transitions fixed per motion mode
  if (!mobile) {
    const tNet = tr(motion, 'opacity 400ms linear', 'opacity 200ms linear'), tCl = tr(motion, 'opacity 400ms linear 900ms', 'opacity 200ms linear');
    for (const c of caps) c.inner.style.transition = tNet;
    for (const t of clInner) t.style.transition = tCl;
  }
  function applyPhase(ph: Phase) {
    if (mobile) return; // mframe() has no reveals: everything is present from the first frame (line 492)
    const on = (k: Phase) => !full || ge(ph, k); // line 436
    for (const r of reveals) { const o = on(r.k); r.el.style.opacity = o ? '1' : '0'; if (r.tf) r.el.style.transform = o ? 'none' : 'translateY(12px)'; }
    const netOp = on('caps') ? '1' : '0'; for (const c of caps) c.inner.style.opacity = netOp;
    const clOp = on('map') ? '1' : '0'; for (const t of clInner) t.style.opacity = clOp;
    if (skip) skip.style.display = full && !ge(ph, 'ready') ? '' : 'none'; // showSkip, line 465
  }
  // hover / focus / pin (line 470 / 505): node ×1.5 inside the 45% ring when lit, filled with material when pinned; coordinates brighten; aria state
  function applyHotSel() {
    caps.forEach((c, i) => {
      const lit = hot === i || sel === i, pinned = sel === i;
      c.node.style.background = pinned ? 'var(--mat)' : '#000';
      c.node.style.transform = lit ? 'scale(1.5)' : 'scale(1)';
      c.ring.style.opacity = lit ? '.45' : '0';
      if (c.coord) c.coord.style.color = lit ? '#9CA096' : '#73776D';
      c.btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      c.btn.setAttribute('aria-label', CAPS[i].name + ', ' + CAPS[i].country + (pinned ? ' — e zgjedhur' : ''));
    });
  }

  // ---- The Stage: appends the page-ground SVG to .cs-ground and the plane + overlay SVGs to .cs-stage in its constructor ----
  const hooks: StageHooks = { onPhase: ph => applyPhase(ph), onHot: i => { hot = i; applyHotSel(); }, onSel: i => { sel = i; applyHotSel(); }, scrollTo };
  const stage: StageApi = g ? new Stage({ G, g, stage: stageEl, ground, motion, mobile, hooks, tourMs: opts.tourMs }) : new NullStage();
  applyPhase(stage.phase); applyHotSel();
  // template order (line 43–72 / 86–94); without geometry the brand composition at rest — the icon whole, logo, statement, badges, form, footer; no capitals, towns, cue or knot
  const children: (HTMLElement | null)[] = mobile
    ? [yimg, logo, soon, ...caps.map(c => c.block), ...towns.map(t => t.w), knotBtn, h1, badges.nav, g && cueWrap]
    : [yimg, logo, skip, soon, ...clOuter, ...caps.map(c => c.block), ...towns.map(t => t.w), g && cueWrap, knotBtn, h1, badges.nav, formSection, footer];
  for (const c of children) if (c) stageEl.append(c);
  stage.bind({ caps: caps.map(c => ({ b: c.block, t: c.lab, k: c.coord })), towns, clabels: clOuter, cue: cueBtn, knot: knotBtn, yimg, dot });
  const form = mountForm(stateHost, { id: ids.email, layout: mobile ? 'stack' : 'row', endpoint, privacyId: ids.privacy });

  // ---- Events (frame() 461–465 / 472, mframe() 500–501 / 507) ----
  if (skip) skip.addEventListener('click', () => stage.skip());
  replay.addEventListener('click', () => stage.play('first')); // line 457
  cueBtn.addEventListener('click', tie);
  knotBtn?.addEventListener('click', release);
  caps.forEach((c, i) => {
    c.btn.addEventListener('click', () => stage.togglePick(i));
    c.btn.addEventListener('focus', () => stage.setHot(i));
    c.btn.addEventListener('blur', () => stage.setHot(null));
  });
  // pointer → stage design px (the stage box is scaled by s); desktop only in full motion, mobile also on pointerdown (the lamp)
  const onMove = (e: PointerEvent) => { const r = stageEl.getBoundingClientRect(), sc = r.width / W || 1; stage.pointerMove((e.clientX - r.left) / sc, (e.clientY - r.top) / sc, e.clientX, e.clientY); };
  const onLeave = () => stage.pointerLeave();
  if (mobile || full) stageEl.addEventListener('pointermove', onMove);
  stageEl.addEventListener('pointerleave', onLeave);
  if (mobile) { stageEl.addEventListener('pointerdown', onMove); stageEl.addEventListener('pointerup', onLeave); stageEl.addEventListener('pointercancel', onLeave); }
  // Esc: skips the intro while it plays, otherwise releases the knot (line 462). `ready` is the view-model's gate of line 438 (on('ready') = !full || phase ≥ 'ready'):
  // with motion reduced / static it is always true, so Esc only ever releases to the top and never writes the intro's 'seen' flag.
  const ready = () => !full || stage.ready();
  const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (!mobile && !ready()) stage.skip(); else release(); };
  window.addEventListener('keydown', onKey);
  // scroll → progress in design px (the stage clamps by its track). The position is kept in design px so a resize restores it (layout):
  // the prototype's frames are fixed-size (line 461 / 500), so progress can never move without the user scrolling.
  let designTop = 0;
  frame.addEventListener('scroll', () => { designTop = frame.scrollTop / s; stage.setScroll(designTop); }, { passive: true });

  // ---- Scale-to-fit: s = min(vw/W, vh/H), the stage centred in the letterbox, the track one viewport + the scroll length ----
  const trackLen = g ? G.track : 0;
  let prevS = 0, prevVh = 0;
  const layout = () => {
    const vw = frame.clientWidth || window.innerWidth, vh = frame.clientHeight || window.innerHeight;
    s = Math.min(vw / W, vh / H) || 1;
    const offX = Math.max(0, (vw - W * s) / 2), offY = Math.max(0, (vh - H * s) / 2);
    frame.style.setProperty('--cs-scale', String(s));
    fit.style.height = vh + 'px';
    scaled.style.left = offX + 'px'; scaled.style.top = offY + 'px'; scaled.style.transform = 'scale(' + s + ')';
    // the sticky stage must stay pinned for the whole transformation: one viewport height + the track at the current scale
    // (rounded UP: the browser rounds the scroll extent down, so a fractional track × s would stop the scroll a hair short of progress 1)
    track.style.height = Math.ceil(vh + trackLen * s) + 'px';
    if (below && belowBox) { below.style.left = offX + 'px'; below.style.transform = 'scale(' + s + ')'; belowBox.style.height = (below.offsetHeight * s) + 'px'; }
    // the viewport changed: put the scroll back where it was in design px — a new s moved it in CSS px, and a taller viewport had it clamped
    // against the old track before the track grew (that clamp's scroll event is dispatched after the window's resize event, so designTop still holds the position)
    if (s !== prevS || vh !== prevVh) { prevS = s; prevVh = vh; frame.scrollTop = designTop * s; }
    // the page ground extends past the stage so the device matrix covers the letterboxed viewport
    stage.setPad(Math.max(0, (vw / s - W) / 2), Math.max(0, (vh / s - H) / 2));
    stage.setScroll(frame.scrollTop / s);
  };
  root.append(frame);
  layout();
  // window resize (dispatched before the scroll steps) restores the position in time; the ResizeObserver covers the frame and the mobile form's height
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null;
  if (ro) { ro.observe(frame); if (below) ro.observe(below); }
  window.addEventListener('resize', layout);

  return {
    stage, frame,
    get scale() { return s; },
    destroy() {
      if (ro) ro.disconnect(); window.removeEventListener('resize', layout);
      window.removeEventListener('keydown', onKey);
      form.destroy(); stage.destroy(); frame.remove();
    },
  };
}

/** The official store badges (line 53 / 93): Apple 32px tall, Google 48px with −8px side margins; on either image's error both become the outline pills. */
function buildBadges(): { nav: HTMLElement } {
  const nav = h('nav', { class: 'cs-badges', 'aria-label': 'Aplikacioni NYJA' });
  let failed = false;
  const pill = (aria: string, label: string) => h('a', { href: '#', role: 'link', class: 'cs-pill', 'aria-label': aria }, h('span', { class: 'cs-pill-ph', 'aria-hidden': 'true' }), label);
  const fail = () => { if (failed) return; failed = true; nav.replaceChildren(pill('App Store — së shpejti', 'App Store'), pill('Google Play — së shpejti', 'Google Play')); };
  const img = (src: string, alt: string) => { const im = h('img', { alt }); im.addEventListener('error', fail); im.src = src; return im; };
  nav.append(
    h('a', { href: '#', class: 'cs-badge cs-badge--apple', 'aria-label': 'Download on the App Store — së shpejti' }, img('https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us', 'Download on the App Store')),
    h('a', { href: '#', class: 'cs-badge cs-badge--google', 'aria-label': 'Get it on Google Play — së shpejti' }, img('https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png', 'Get it on Google Play')));
  return { nav };
}
