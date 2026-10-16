// Mobile 390 × 844 — the pinned stage, the tour on mount, the form one swipe below. Same debug surface as desktop.spec.ts.
import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { MOB } from '../src/config';

interface StageDebug { phase: string; progress: number; target: number; hot: number | null; sel: number | null; cut: boolean; tour: number; ready(): boolean }
interface NyjaDebug { page: { scale: number }; stage: StageDebug; canvas: unknown; motion: string; visit: string; lang: string }
type W = Window & { __nyja?: NyjaDebug };

/** Console errors + page errors are collected for every test and must be empty. This sandbox cannot reach Apple's / Google's badge hosts, so those two image failures — and any other net::ERR resource failure — are expected and ignored; so is a missing licensed font (public/fonts is gitignored — the page falls back). */
const EXPECTED = /net::ERR|applemediaservices\.com|play\.google\.com|\/fonts\//;
const test = base.extend<{ cleanConsole: void }>({
  cleanConsole: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() !== 'error') return; const s = m.text() + ' @ ' + m.location().url; if (!EXPECTED.test(s)) errors.push(s); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await use();
    expect(errors, 'console errors / page errors').toEqual([]);
  }, { auto: true }],
});

const boot = async (page: Page, query: string) => { await page.goto('/?' + query); await page.waitForFunction(() => !!(window as W).__nyja?.stage); };
const snap = (page: Page) => page.evaluate(() => { const s = (window as W).__nyja!.stage; return { phase: s.phase, progress: s.progress, target: s.target, hot: s.hot, sel: s.sel, cut: s.cut, tour: s.tour, ready: s.ready() }; });
const phase = async (page: Page) => (await snap(page)).phase;
const progress = async (page: Page) => (await snap(page)).progress;
const tour = async (page: Page) => (await snap(page)).tour;
/** Scroll the frame to a fraction of the track — G.track design px × the page scale, exactly as the page reads it back. */
const scrollTrack = (page: Page, frac: number) => page.evaluate(([f, track]) => { const n = (window as W).__nyja!; document.querySelector<HTMLElement>('.cs-frame')!.scrollTo({ top: f * track * n.page.scale }); }, [frac, MOB.track] as const);
const scrollToEnd = (page: Page) => page.evaluate(() => { const f = document.querySelector<HTMLElement>('.cs-frame')!; f.scrollTo({ top: f.scrollHeight }); });
/** The van group (reg.van): the <g> around the clipped body — found by its clip group, else by a wheel (r 50). −1 when there is no van. */
const vanOpacity = (page: Page) => page.evaluate(() => { const g = document.querySelector('.cs-stage svg g[clip-path]')?.parentElement ?? document.querySelector('.cs-stage svg circle[r="50"]')?.parentElement; return g ? parseFloat(getComputedStyle(g).opacity) : -1; });
/** The flow pulses: 2px paths with the '3 97' dash on the cs-flow loop — three in full motion, none otherwise. */
const pulseCount = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll<SVGPathElement>('.cs-stage svg path')).filter((p) => /cs-flow/.test(getComputedStyle(p).animationName) || (p.getAttribute('stroke-dasharray') ?? p.style.strokeDasharray).replace(/,/g, ' ').trim() === '3 97').length);
const icon = (page: Page) => page.locator('.cs-stage img[src$="nyja-icon-neon.svg"]');
const maskOf = (page: Page) => icon(page).evaluate((el) => { const s = getComputedStyle(el); return s.maskImage || s.webkitMaskImage || el.style.maskImage || el.style.webkitMaskImage; });
/** Horizontal overflow: the document and the scroll container itself (overflow-x hidden still reports a wider scrollWidth). */
const overflow = (page: Page) => page.evaluate(() => { const f = document.querySelector<HTMLElement>('.cs-frame')!; return { doc: document.documentElement.scrollWidth - innerWidth, frame: f.scrollWidth - f.clientWidth }; });
/** A native touch event on the stage at a design-px position (client = the stage's rect + p × its scale) — the finger lamp listens to these, not to pointer events. */
const touch = (page: Page, type: 'touchstart' | 'touchmove' | 'touchend', x: number, y: number) => page.evaluate(([type, x, y, W]) => {
  const el = document.querySelector<HTMLElement>('.cs-stage')!, r = el.getBoundingClientRect(), sc = r.width / W;
  const t = new Touch({ identifier: 1, target: el, clientX: r.left + x * sc, clientY: r.top + y * sc });
  const touches = type === 'touchend' ? [] : [t];
  el.dispatchEvent(new TouchEvent(type, { touches, changedTouches: [t], targetTouches: touches, bubbles: true, cancelable: true }));
}, [type, x, y, MOB.W] as const);
/** The lamp: the lit copies of the page ground (inline opacity '0' / '1', faded by CSS) and the torch mask's centre in design px. */
const lamp = (page: Page) => page.evaluate(() => { const g = document.querySelector<SVGGElement>('.cs-ground svg > g')!, c = document.querySelector<SVGCircleElement>('.cs-stage svg mask#tm circle')!; return { on: g.style.opacity, x: parseFloat(c.getAttribute('cx')!), y: parseFloat(c.getAttribute('cy')!), fill: g.firstElementChild!.getAttribute('fill') }; });
/** Screenshots for human review: test-results/shots/<name>.png */
const shot = (t: TestInfo, name: string) => t.project.outputDir + '/shots/' + name + '.png';

test.describe('mobile 390 × 844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('loads clean; the tour runs on mount and ends in links; no horizontal overflow', async ({ page }, testInfo) => {
    await boot(page, 'motion=full&canvas=m&tourms=3000');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('tour'); // no timers on mobile: the tour starts with the mount
    await expect.poll(() => tour(page), { timeout: 5_000 }).toBeGreaterThan(0);
    await expect.poll(() => vanOpacity(page), { timeout: 3_000, intervals: [40, 40, 80, 120] }).toBeGreaterThan(0);
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('links'); // the mobile "done"
    expect(await snap(page)).toMatchObject({ tour: 1, progress: 0, cut: false });
    expect(await vanOpacity(page)).toBe(0);
    expect(await pulseCount(page)).toBe(3);
    const ov = await overflow(page);
    expect(ov.doc).toBeLessThanOrEqual(0);
    expect(ov.frame).toBeLessThanOrEqual(0);
    // desktop-only furniture is absent: skip link, country names, coordinates
    await expect(page.getByRole('button', { name: 'Kalo hyrjen' })).toHaveCount(0);
    await expect(page.locator('.cs-stage').getByText('KOSOVË', { exact: true })).toHaveCount(0);
    await expect(page.locator('.cs-stage').getByText('42.67° N · 21.17° E')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Lëviz poshtë për të lidhur' })).toBeVisible();
    await page.screenshot({ path: shot(testInfo, 'mobile-0') });
  });

  test('the first 400 px of scroll form the icon; the form and footer sit one swipe below the stage', async ({ page }, testInfo) => {
    await boot(page, 'motion=full&canvas=m&tourms=1500');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('links');
    await scrollTrack(page, 1);
    await expect.poll(() => progress(page), { timeout: 5_000 }).toBe(1);
    await expect(icon(page)).toHaveCSS('opacity', '1');
    expect(await maskOf(page)).toContain('rect');
    await expect(page.getByRole('button', { name: 'Lëviz poshtë për të lidhur' })).toBeHidden();
    await expect(page.getByRole('button', { name: /^NYJA — lidhja është formuar/ })).toBeVisible();
    await expect(page.locator('.cs-stage h1 span')).toHaveCSS('color', 'rgb(213, 255, 0)');
    await page.screenshot({ path: shot(testInfo, 'mobile-400') });
    await scrollToEnd(page);
    await expect(page.locator('input[name="email"]')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Më njofto' })).toBeInViewport();
    await expect(page.getByText('© 2026 NYJA')).toBeInViewport();
    expect((await snap(page)).progress).toBe(1); // past the track the stage stays at its end
    expect((await overflow(page)).frame).toBeLessThanOrEqual(0);
  });

  test('tapping a capital pins it', async ({ page }) => {
    await boot(page, 'motion=full&canvas=m&tourms=1500');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('links');
    const btn = page.getByRole('button', { name: /^Shkup, Maqedonia e Veriut/ });
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect.poll(async () => (await snap(page)).sel).toBe(1);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn).toHaveAttribute('aria-label', 'Shkup, Maqedonia e Veriut — e zgjedhur');
    await btn.click();
    await expect.poll(async () => (await snap(page)).sel).toBeNull();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  test('the finger lamp: a touch lights the ground under the finger, brighter than for the mouse, and is glued to it; it holds 1200 ms after lift, then goes out', async ({ page }) => {
    await boot(page, 'motion=full&canvas=m&tourms=1500');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('links');
    expect(await lamp(page)).toMatchObject({ on: '0', fill: 'url(#dotsbgl)' });
    await touch(page, 'touchstart', 120, 300);
    await expect.poll(async () => (await lamp(page)).on).toBe('1');
    await expect.poll(async () => { const l = await lamp(page); return Math.hypot(l.x - 120, l.y - 300); }, { timeout: 1_000 }).toBeLessThan(1); // on the finger at once
    expect((await lamp(page)).fill).toBe('url(#dotsbglt)'); // the brighter copies under a finger
    await touch(page, 'touchmove', 260, 500);
    await expect.poll(async () => { const l = await lamp(page); return Math.hypot(l.x - 260, l.y - 500); }, { timeout: 1_000 }).toBeLessThan(1); // glued: no spring lag
    await touch(page, 'touchmove', 60, 700);
    await expect.poll(async () => { const l = await lamp(page); return Math.hypot(l.x - 60, l.y - 700); }, { timeout: 1_000 }).toBeLessThan(1);
    await touch(page, 'touchend', 60, 700);
    await page.waitForTimeout(500);
    expect(await lamp(page)).toMatchObject({ on: '1', fill: 'url(#dotsbglt)' }); // the 1200 ms hold after lift
    await expect.poll(async () => (await lamp(page)).on, { timeout: 3_000 }).toBe('0');
    expect((await lamp(page)).fill).toBe('url(#dotsbgl)');
  });

  test('English on mobile: ?lang=en — the cue, the capitals, the statement, the form; the footer switch keeps the scroll', async ({ page }) => {
    await boot(page, 'motion=full&canvas=m&tourms=1500&lang=en');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('links');
    await expect(page.getByRole('button', { name: 'Scroll down to connect' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Skopje, North Macedonia/ })).toHaveCount(1);
    await expect(page.locator('.cs-stage').getByText('TIRANA', { exact: true })).toBeVisible();
    await expect(page.locator('.cs-stage h1')).toContainText('Everything');
    await scrollToEnd(page);
    await expect(page.getByRole('button', { name: 'Notify me' })).toBeInViewport();
    await expect(page.getByText('Be the first to connect.')).toBeInViewport();
    await expect(page.locator('.cs-below-footer .cs-lang-on')).toHaveText('EN');
    expect((await overflow(page)).frame).toBeLessThanOrEqual(0);
    await page.getByRole('link', { name: 'Shqip' }).click();
    await page.waitForFunction(() => (window as W).__nyja?.lang === 'sq');
    await expect(page.getByRole('button', { name: 'Më njofto' })).toBeInViewport(); // the re-mount kept the position: the form is still in view
    await expect(page.locator('.cs-below-footer .cs-lang-on')).toHaveText('SQ');
    expect(await page.evaluate(() => localStorage.getItem('nyja-cs-lang'))).toBe('sq');
  });

  test('mobile form: validation, then a valid address is confirmed (simulation mode)', async ({ page }) => {
    await boot(page, 'motion=reduced&canvas=m');
    await scrollToEnd(page);
    const input = page.locator('input[name="email"]');
    const submit = page.getByRole('button', { name: 'Më njofto' });
    await expect(input).toBeInViewport();
    await submit.click();
    await expect(page.getByText('Shkruaj një email të vlefshëm, p.sh. emri@domain.com')).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    const sim = await page.getByText('Prototip UI/UX — asnjë email nuk regjistrohet.').count();
    test.skip(sim === 0, 'VITE_SUBSCRIBE_URL is set — the live endpoint decides the outcome');
    await input.fill('emri@domain.com');
    await submit.click();
    await expect(page.getByRole('status')).toContainText('U regjistrove me sukses.');
  });

  test('reduced / static: no tour, the trail at rest; static is already transformed', async ({ page }) => {
    await boot(page, 'motion=reduced&canvas=m');
    await expect.poll(() => snap(page), { timeout: 10_000 }).toMatchObject({ phase: 'links', tour: 1 });
    expect(await pulseCount(page)).toBe(0);
    expect(await vanOpacity(page)).toBeLessThanOrEqual(0);
    await scrollTrack(page, .6);
    await expect.poll(() => progress(page), { timeout: 5_000 }).toBe(1); // snap at 50 %
    await boot(page, 'motion=static&canvas=m');
    await expect.poll(() => progress(page), { timeout: 3_000 }).toBe(1);
    await expect(icon(page)).toHaveCSS('opacity', '1');
    expect(await maskOf(page)).toContain('rect');
    expect((await overflow(page)).frame).toBeLessThanOrEqual(0);
  });

  test('the scroll position is kept in design px: a viewport height change (browser chrome) never moves the progress', async ({ page }) => {
    await boot(page, 'motion=full&canvas=m&tourms=1500');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('links');
    await scrollTrack(page, .6);
    await expect.poll(async () => (await snap(page)).target).toBeCloseTo(.6, 3);
    for (const h of [664, 844]) { await page.setViewportSize({ width: 390, height: h }); await page.waitForTimeout(120); expect((await snap(page)).target, '390×' + h).toBeCloseTo(.6, 2); }
  });
});
