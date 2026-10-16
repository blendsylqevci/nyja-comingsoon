// Desktop 1440 × 900 — smoke / behaviour tests of the live page against `vite preview` (build first).
// The page is driven only through its documented debug surface: the URL params ?motion ?visit ?canvas ?tourms and window.__nyja.
import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { DESK } from '../src/config';

type Visit = 'first' | 'returning';
interface StageDebug { phase: string; progress: number; target: number; hot: number | null; sel: number | null; cut: boolean; tour: number; ready(): boolean; skip(): void; play(visit: Visit): void; setScroll(topDesignPx: number): void }
interface NyjaDebug { page: { scale: number }; stage: StageDebug; canvas: unknown; motion: string; visit: string; lang: string }
type W = Window & { __nyja?: NyjaDebug };

/** Console errors + page errors are collected for every test and must be empty. This sandbox cannot reach Apple's / Google's badge hosts, so those two image failures — and any other net::ERR resource failure — are expected and ignored; so is a missing licensed font (public/fonts is gitignored — the page falls back). */
// The mocked 409 / 500 answers of the subscribe endpoint are logged by Chromium as resource errors — they are the point of that test, not a page error.
const EXPECTED = /net::ERR|applemediaservices\.com|play\.google\.com|\/fonts\/|status of (409|500) \([^)]*\) @ \S*\/functions\/v1\/subscribe/;
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
const hot = async (page: Page) => (await snap(page)).hot;
/** Scroll the frame to a fraction of the track — G.track design px × the page scale, exactly as the page reads it back. */
const scrollTrack = (page: Page, frac: number) => page.evaluate(([f, track]) => { const n = (window as W).__nyja!; document.querySelector<HTMLElement>('.cs-frame')!.scrollTo({ top: f * track * n.page.scale }); }, [frac, DESK.track] as const);
const frameTop = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('.cs-frame')!.scrollTop);
/** The van group (reg.van): the <g> around the clipped body — found by its clip group, else by a wheel (r 50). −1 when there is no van. */
const vanOpacity = (page: Page) => page.evaluate(() => { const g = document.querySelector('.cs-stage svg g[clip-path]')?.parentElement ?? document.querySelector('.cs-stage svg circle[r="50"]')?.parentElement; return g ? parseFloat(getComputedStyle(g).opacity) : -1; });
/** The flow pulses: 2px paths with the '3 97' dash on the cs-flow loop — three in full motion, none otherwise. */
const pulseCount = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll<SVGPathElement>('.cs-stage svg path')).filter((p) => /cs-flow/.test(getComputedStyle(p).animationName) || (p.getAttribute('stroke-dasharray') ?? p.style.strokeDasharray).replace(/,/g, ' ').trim() === '3 97').length);
const icon = (page: Page) => page.locator('.cs-stage img[src$="nyja-icon-neon.svg"]');
const maskOf = (page: Page) => icon(page).evaluate((el) => { const s = getComputedStyle(el); return s.maskImage || s.webkitMaskImage || el.style.maskImage || el.style.webkitMaskImage; });
const cue = (page: Page) => page.getByRole('button', { name: 'Lëviz poshtë për të lidhur' });
const knot = (page: Page) => page.getByRole('button', { name: /^NYJA — lidhja është formuar/ });
/** A native touch event at a stage design-px position (client = the stage's rect + p × its scale), dispatched on `on` (the stage, or the frame — where the lamp listens; the letterbox is outside the stage). */
const touch = (page: Page, type: 'touchstart' | 'touchmove' | 'touchend', x: number, y: number, on = '.cs-stage') => page.evaluate(([type, x, y, W, on]) => {
  const st = document.querySelector<HTMLElement>('.cs-stage')!, el = document.querySelector<HTMLElement>(on)!, r = st.getBoundingClientRect(), sc = r.width / W;
  const t = new Touch({ identifier: 1, target: el, clientX: r.left + x * sc, clientY: r.top + y * sc });
  const touches = type === 'touchend' ? [] : [t];
  el.dispatchEvent(new TouchEvent(type, { touches, changedTouches: [t], targetTouches: touches, bubbles: true, cancelable: true }));
}, [type, x, y, DESK.W, on] as const);
/** The lamp: the lit copies of the page ground (inline opacity '0' / '1', faded by CSS) and the torch mask's centre in design px. */
const lamp = (page: Page) => page.evaluate(() => { const g = document.querySelector<SVGGElement>('.cs-ground svg > g')!, c = document.querySelector<SVGCircleElement>('.cs-stage svg mask#tm circle')!; return { on: g.style.opacity, x: parseFloat(c.getAttribute('cx')!), y: parseFloat(c.getAttribute('cy')!), fill: g.firstElementChild!.getAttribute('fill') }; });
/** The map plane's tilt (rotateX · rotateY, written by the stage every frame it changes). */
const tilt = (page: Page) => page.evaluate(() => { const m = /rotateX\(([-\d.]+)deg\) rotateY\(([-\d.]+)deg\)/.exec(document.querySelector<HTMLElement>('.cs-stage > div')!.style.transform); return { ax: m ? parseFloat(m[1]) : NaN, ay: m ? parseFloat(m[2]) : NaN }; });
/** Screenshots for human review: test-results/shots/<name>.png */
const shot = (t: TestInfo, name: string) => t.project.outputDir + '/shots/' + name + '.png';

test.describe('desktop 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('loads clean; the intro reaches ready through a short tour — the van drives mid-tour, three pulses flow at rest', async ({ page }) => {
    await boot(page, 'motion=full&visit=first&canvas=d&tourms=2500');
    // dark → map (400ms) → caps (1500) → tour (2000) → links (tour end) → ready (+900)
    await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('tour');
    await expect.poll(() => vanOpacity(page), { timeout: 2_500, intervals: [40, 40, 80, 120] }).toBeGreaterThan(0);
    await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('ready');
    const s = await snap(page);
    expect(s.ready).toBe(true);
    expect(s.tour).toBe(1);
    expect(s.progress).toBe(0);
    expect(s.cut).toBe(false);
    expect(await pulseCount(page)).toBe(3);
    // the van is gone once the tour has ended; the skip link too
    expect(await vanOpacity(page)).toBe(0);
    await expect(page.getByRole('button', { name: 'Kalo hyrjen' })).toBeHidden();
    await expect(cue(page)).toBeVisible();
  });

  test('"Kalo hyrjen" skips to ready at once and remembers the visit', async ({ page }, testInfo) => {
    await boot(page, 'motion=full&visit=first&canvas=d&tourms=30000');
    // play() starts 500ms after the fonts; skipping before that would be undone by it — wait until the intro is actually running.
    await expect.poll(() => phase(page), { timeout: 15_000 }).not.toBe('dark');
    const skip = page.getByRole('button', { name: 'Kalo hyrjen' });
    await expect(skip).toBeVisible();
    const r = await page.evaluate(async () => {
      const n = (window as W).__nyja!;
      const b = Array.from(document.querySelectorAll('button')).find((x) => /Kalo hyrjen/.test(x.textContent ?? ''));
      if (!b) throw new Error('no skip button');
      const t0 = performance.now();
      b.click();
      while (n.stage.phase !== 'ready' && performance.now() - t0 < 100) await new Promise((res) => setTimeout(res, 5));
      let seen: string | null = null;
      try { seen = localStorage.getItem('nyja-cs-intro'); } catch { /* storage may be blocked */ }
      return { phase: n.stage.phase, ms: performance.now() - t0, seen };
    });
    expect(r.phase).toBe('ready');
    expect(r.ms).toBeLessThanOrEqual(100);
    expect(r.seen).toBe('seen');
    await expect.poll(() => tour(page)).toBe(1); // the rAF clock sets tour on the next frame once the phase is past 'links'
    await expect(skip).toBeHidden();
    // the cue reveals (560ms) and the three connections draw (520ms + 320ms stagger) — settle before the still
    await expect(cue(page)).toHaveCSS('opacity', '1');
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: shot(testInfo, 'desktop-ready') });
  });

  test('Escape skips the intro; at ready it releases the frame to the top', async ({ page }) => {
    await boot(page, 'motion=full&visit=first&canvas=d&tourms=30000');
    await expect.poll(() => phase(page), { timeout: 15_000 }).not.toBe('dark');
    await page.keyboard.press('Escape');
    await expect.poll(() => phase(page)).toBe('ready');
    await scrollTrack(page, 1);
    await expect.poll(() => progress(page), { timeout: 5_000 }).toBe(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => frameTop(page), { timeout: 5_000 }).toBe(0); // smooth scroll in full motion
    await expect.poll(() => progress(page), { timeout: 5_000 }).toBe(0);
  });

  test('the scroll owns the transformation: eased to 50 %, the icon total at the end of the track', async ({ page }, testInfo) => {
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    await expect(icon(page)).toHaveCSS('opacity', '0');
    await scrollTrack(page, .5);
    await expect.poll(() => progress(page), { timeout: 5_000 }).toBeCloseTo(.5, 3); // fk eases toward form and snaps within .0015
    expect((await snap(page)).target).toBeCloseTo(.5, 3);
    await expect(icon(page)).toHaveCSS('opacity', '0'); // visible only from 60 %
    await page.screenshot({ path: shot(testInfo, 'desktop-50') });
    await scrollTrack(page, 1);
    await expect.poll(() => progress(page), { timeout: 5_000 }).toBe(1);
    await expect(icon(page)).toHaveCSS('opacity', '1');
    expect(await maskOf(page)).toContain('rect'); // total mask from 97 %
    await expect(cue(page)).toBeHidden(); // opacity 0 + visibility hidden past 25 %
    await expect(page.locator('.cs-stage h1 span')).toHaveCSS('color', 'rgb(213, 255, 0)'); // the period in MAT past 95 %
    await expect(knot(page)).toBeVisible(); // the knot button from 90 %
    await page.screenshot({ path: shot(testInfo, 'desktop-100') });
  });

  test('scrolling during the tour cuts it; back at the top the tour restarts from Prishtinë', async ({ page }) => {
    await boot(page, 'motion=full&visit=first&canvas=d&tourms=30000');
    await expect.poll(() => phase(page), { timeout: 15_000 }).toBe('tour');
    await expect.poll(() => tour(page), { timeout: 5_000 }).toBeGreaterThan(0); // the clock runs
    await scrollTrack(page, .3);
    await expect.poll(() => snap(page), { timeout: 5_000 }).toMatchObject({ cut: true, tour: 1 });
    expect(['links', 'ready']).toContain((await snap(page)).phase);
    await expect.poll(() => phase(page), { timeout: 5_000 }).toBe('ready'); // links → ready after 900ms
    expect(await vanOpacity(page)).toBe(0);
    await scrollTrack(page, 0);
    await expect.poll(() => snap(page), { timeout: 5_000 }).toMatchObject({ phase: 'tour', cut: false, progress: 0 });
    await expect.poll(() => tour(page), { timeout: 5_000 }).toBeLessThan(1); // the clock was reset …
    await expect.poll(() => tour(page), { timeout: 5_000 }).toBeGreaterThan(0); // … and runs again
  });

  test('capital hover and pin: hit-test at the projected position, label colour, aria state', async ({ page }) => {
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    const btn = page.getByRole('button', { name: /^Prishtinë, Kosovë/ });
    const label = page.locator('.cs-stage').getByText('PRISHTINË', { exact: true });
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(label).toHaveCSS('color', 'rgb(196, 200, 187)'); // #C4C8BB at rest
    // The 44 × 44 block is translated to the projected capital every frame, so its centre IS the projected position.
    const box = await btn.boundingBox();
    if (!box) throw new Error('capital button has no box');
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx - 40, cy - 40);
    await page.mouse.move(cx, cy, { steps: 4 });
    await expect.poll(() => hot(page)).toBe(0);
    await expect(label).toHaveCSS('color', 'rgb(255, 255, 255)');
    // away from every capital (> hit 90px) and off the land → nothing lit
    await page.mouse.move(300, 300, { steps: 4 });
    await expect.poll(() => hot(page)).toBeNull();
    await expect(label).toHaveCSS('color', 'rgb(196, 200, 187)');
    // keyboard focus lights it too
    await btn.focus();
    await expect.poll(() => hot(page)).toBe(0);
    await btn.blur();
    await expect.poll(() => hot(page)).toBeNull();
    // click = pin
    await btn.click();
    await expect.poll(async () => (await snap(page)).sel).toBe(0);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn).toHaveAttribute('aria-label', 'Prishtinë, Kosovë — e zgjedhur');
    await btn.click();
    await expect.poll(async () => (await snap(page)).sel).toBeNull();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(btn).toHaveAttribute('aria-label', 'Prishtinë, Kosovë');
  });

  test('touch on the desktop canvas: the lamp is glued to the finger and brighter under it, the finger tilts the plane; 1200 ms hold after lift, then both settle', async ({ page }) => {
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    expect(await lamp(page)).toMatchObject({ on: '0', fill: 'url(#dotsbgl)' });
    expect((await tilt(page)).ay).toBeCloseTo(0, 1);
    await touch(page, 'touchstart', 200, 700, '.cs-frame'); // on the frame (where the lamp listens); bottom-left: tx −0.72 → rotateY −4.3° (px eases 8 % per frame), ty +0.56 → rotateX 52° + 1.7°
    await expect.poll(async () => (await lamp(page)).on).toBe('1');
    await expect.poll(async () => { const l = await lamp(page); return Math.hypot(l.x - 200, l.y - 700); }, { timeout: 1_000 }).toBeLessThan(1);
    expect((await lamp(page)).fill).toBe('url(#dotsbglt)'); // the brighter copies under a finger
    await expect.poll(async () => (await tilt(page)).ay, { timeout: 5_000 }).toBeLessThan(-3);
    expect((await tilt(page)).ax).toBeGreaterThan(52.5);
    // glued: a move lands the light on the finger at once — no spring lag (the mouse keeps its spring)
    await touch(page, 'touchmove', 900, 300);
    await expect.poll(async () => { const l = await lamp(page); return Math.hypot(l.x - 900, l.y - 300); }, { timeout: 1_000 }).toBeLessThan(1);
    await touch(page, 'touchend', 900, 300);
    await page.waitForTimeout(500);
    expect(await lamp(page)).toMatchObject({ on: '1', fill: 'url(#dotsbglt)' }); // the 1200 ms hold after lift
    await expect.poll(async () => (await lamp(page)).on, { timeout: 3_000 }).toBe('0');
    expect((await lamp(page)).fill).toBe('url(#dotsbgl)'); // back to the mouse brightness
    await expect.poll(async () => Math.abs((await tilt(page)).ay), { timeout: 5_000 }).toBeLessThan(.5); // the plane levels again
  });

  test('English: ?lang=en renders the English copy; the footer switch persists the choice, keeps the scroll and switches back', async ({ page }) => {
    await boot(page, 'motion=full&visit=returning&canvas=d&lang=en');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    expect(await page.evaluate(() => [document.documentElement.lang, document.title, (window as W).__nyja!.lang])).toEqual(['en', 'NYJA — Coming soon', 'en']);
    await expect(page.locator('.cs-stage h1')).toContainText('Everything');
    await expect(page.locator('.cs-stage h1')).toContainText('Connects');
    await expect(page.getByRole('button', { name: 'Skip intro' })).toBeHidden(); // ready: the skip is gone, but it was the English one
    await expect(page.getByRole('button', { name: 'Scroll down to connect' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pristina, Kosovo/ })).toHaveCount(1);
    await expect(page.locator('.cs-stage').getByText('PRISTINA', { exact: true })).toBeVisible();
    await expect(page.locator('.cs-stage').getByText('NORTH MACEDONIA', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notify me' })).toBeVisible();
    await expect(page.locator('input[name="email"]')).toHaveAttribute('placeholder', 'name@domain.com');
    await expect(page.getByText('Your email is used only for the launch notification.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Replay the intro' })).toBeVisible();
    // Albanian by default; EN in the footer re-mounts in English, remembers it (localStorage) and keeps the scroll position
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    await expect(page.locator('.cs-stage h1')).toContainText('Gjithçka');
    await scrollTrack(page, .5);
    await expect.poll(async () => (await snap(page)).target).toBeCloseTo(.5, 3);
    await page.getByRole('link', { name: 'English' }).click();
    await page.waitForFunction(() => (window as W).__nyja?.lang === 'en');
    await expect(page.locator('.cs-stage h1')).toContainText('Everything');
    expect(await page.evaluate(() => [localStorage.getItem('nyja-cs-lang'), document.documentElement.lang])).toEqual(['en', 'en']);
    expect((await snap(page)).target).toBeCloseTo(.5, 2);
    await expect(page.locator('.cs-footer .cs-lang-on')).toHaveText('EN');
    // the choice survives a reload without ?lang=, and SQ switches back
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect(page.locator('.cs-stage h1')).toContainText('Everything');
    await page.getByRole('link', { name: 'Shqip' }).click();
    await page.waitForFunction(() => (window as W).__nyja?.lang === 'sq');
    await expect(page.locator('.cs-stage h1')).toContainText('Gjithçka');
    expect(await page.evaluate(() => localStorage.getItem('nyja-cs-lang'))).toBe('sq');
  });

  test('live endpoint (mocked): 200 → confirmed, 409 → already registered, 500 → error with retry; English copy too', async ({ page }) => {
    await boot(page, 'motion=static&canvas=d');
    const sim = await page.getByText('Prototip UI/UX — asnjë email nuk regjistrohet.').count();
    test.skip(sim > 0, 'VITE_SUBSCRIBE_URL is unset — the form simulates; nothing to mock');
    // the endpoint is never reached: every outcome is fulfilled here (preflight included — the page's POST is cross-origin)
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
    let status = 200;
    await page.route('**/functions/v1/subscribe', (route) => route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(status === 200 ? { ok: true } : { ok: false, error: status === 409 ? 'exists' : 'db' }) }));
    const submit = async (address: string, cta: string) => { await page.locator('input[name="email"]').fill(address); await page.getByRole('button', { name: cta }).click(); };
    await submit('emri@domain.com', 'Më njofto');
    await expect(page.getByRole('status')).toContainText('U regjistrove me sukses.');
    // the same address again: 409 → told it is already registered, shown like success (the address IS on the list), no retry button
    await boot(page, 'motion=static&canvas=d'); status = 409;
    await submit('emri@domain.com', 'Më njofto');
    await expect(page.getByRole('status')).toContainText('Ky email është regjistruar tashmë.');
    await expect(page.getByRole('status')).toContainText('Do të të njoftojmë kur NYJA të lansohet.');
    await expect(page.getByRole('button', { name: 'Provo përsëri' })).toHaveCount(0);
    // our failure: the error state with the retry that keeps the address
    await boot(page, 'motion=static&canvas=d'); status = 500;
    await submit('emri@domain.com', 'Më njofto');
    await expect(page.getByRole('alert')).toContainText('Nuk arritëm ta regjistrojmë emailin.');
    await page.getByRole('button', { name: 'Provo përsëri' }).click();
    await expect(page.locator('input[name="email"]')).toHaveValue('emri@domain.com');
    // the English copy of the 409
    await boot(page, 'motion=static&canvas=d&lang=en'); status = 409;
    await submit('name@domain.com', 'Notify me');
    await expect(page.getByRole('status')).toContainText('This email is already registered.');
  });

  test('form: an invalid address is refused, typing clears the error', async ({ page }) => {
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    const input = page.locator('.cs-stage input[name="email"]');
    const error = page.getByText('Shkruaj një email të vlefshëm, p.sh. emri@domain.com');
    await expect(input).toHaveAttribute('aria-describedby', /.+/);
    await page.getByRole('button', { name: 'Më njofto' }).click();
    await expect(error).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.fill('emri@domain');
    await expect(error).toBeHidden();
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: 'Më njofto' }).click();
    await expect(error).toBeVisible(); // still no TLD
  });

  test('form: a "gabim" address fails with a retry that keeps the address (simulation mode)', async ({ page }) => {
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    const sim = await page.getByText('Prototip UI/UX — asnjë email nuk regjistrohet.').count();
    test.skip(sim === 0, 'VITE_SUBSCRIBE_URL is set — the live endpoint decides the outcome');
    const input = page.locator('.cs-stage input[name="email"]');
    await input.fill('test.gabim@domain.com');
    await page.getByRole('button', { name: 'Më njofto' }).click();
    await expect(page.getByRole('button', { name: 'Po dërgohet…' })).toBeDisabled(); // busy for 900ms
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Nuk arritëm ta regjistrojmë emailin.');
    await alert.getByRole('button', { name: 'Provo përsëri' }).click();
    await expect(input).toHaveValue('test.gabim@domain.com');
    await expect(page.getByRole('button', { name: 'Më njofto' })).toBeEnabled();
  });

  test('form: a valid address is confirmed (simulation mode)', async ({ page }) => {
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    const sim = await page.getByText('Prototip UI/UX — asnjë email nuk regjistrohet.').count();
    test.skip(sim === 0, 'VITE_SUBSCRIBE_URL is set — the live endpoint decides the outcome');
    await page.locator('.cs-stage input[name="email"]').fill('emri@domain.com');
    await page.getByRole('button', { name: 'Më njofto' }).click();
    await expect(page.getByRole('status')).toContainText('U regjistrove me sukses.');
    await expect(page.getByText('Emaili përdoret vetëm për njoftimin e lansimit.')).toBeVisible();
  });

  test('reduced motion: ready at once, no pulses, the track snaps at 50 %', async ({ page }, testInfo) => {
    await boot(page, 'motion=reduced&visit=first&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    expect(await pulseCount(page)).toBe(0);
    expect(await vanOpacity(page)).toBeLessThanOrEqual(0);
    await expect(page.getByRole('button', { name: 'Kalo hyrjen' })).toHaveCount(0);
    await page.screenshot({ path: shot(testInfo, 'desktop-reduced') });
    // play() in reduced motion: dark → ready at 60ms, never through the intro
    const r = await page.evaluate(async () => {
      const n = (window as W).__nyja!;
      n.stage.play('first');
      const t0 = performance.now(), seen = new Set<string>();
      while (n.stage.phase !== 'ready' && performance.now() - t0 < 1_000) { seen.add(n.stage.phase); await new Promise((res) => setTimeout(res, 5)); }
      return { ms: performance.now() - t0, phases: Array.from(seen) };
    });
    expect(r.ms).toBeLessThanOrEqual(200);
    expect(r.phases).not.toContain('tour');
    await expect.poll(() => phase(page)).toBe('ready');
    // snap: form < .5 → 0, form ≥ .5 → 1
    await scrollTrack(page, .4);
    await expect.poll(async () => (await snap(page)).target, { timeout: 5_000 }).toBeCloseTo(.4, 3);
    expect(await progress(page)).toBe(0);
    await scrollTrack(page, .6);
    await expect.poll(() => progress(page), { timeout: 5_000 }).toBe(1);
    await expect(icon(page)).toHaveCSS('opacity', '1');
    await scrollTrack(page, 0);
    await expect.poll(() => progress(page), { timeout: 5_000 }).toBe(0);
  });

  test('static: progress is 1 from the first frame — the final composition', async ({ page }, testInfo) => {
    await boot(page, 'motion=static&canvas=d');
    await expect.poll(() => progress(page), { timeout: 3_000 }).toBe(1);
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    expect(await pulseCount(page)).toBe(0);
    await expect(icon(page)).toHaveCSS('opacity', '1');
    expect(await maskOf(page)).toContain('rect');
    await expect(cue(page)).toBeHidden();
    await expect(knot(page)).toBeVisible();
    await expect(page.locator('.cs-stage h1 span')).toHaveCSS('color', 'rgb(213, 255, 0)');
    await page.screenshot({ path: shot(testInfo, 'desktop-static') });
  });

  test('store badges: the official artwork where the hosts answer, else the outline pills take the place of both', async ({ page }) => {
    await boot(page, 'motion=static&canvas=d');
    const nav = page.getByRole('navigation', { name: 'Aplikacioni NYJA' });
    // Either outcome passes, by network: the CI sandbox cannot reach Apple / Google (the swap happens on the images' error event — a blocked host may fail slowly,
    // hence the generous timeout); a developer's machine loads the stores' own artwork, and then both images must be there and no pill.
    const settled = () => nav.evaluate((el) => { const imgs = Array.from(el.querySelectorAll('img')); if (!imgs.length) return 'pills'; return imgs.every((i) => i.complete && i.naturalWidth > 0) ? 'official' : 'pending'; });
    await expect.poll(settled, { timeout: 30_000 }).not.toBe('pending');
    if (await settled() === 'official') {
      await expect(nav.getByRole('link', { name: 'Download on the App Store — së shpejti', exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Get it on Google Play — së shpejti', exact: true })).toBeVisible();
      await expect(nav.locator('img')).toHaveCount(2);
    } else {
      await expect(nav.getByRole('link', { name: 'App Store — së shpejti', exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Google Play — së shpejti', exact: true })).toBeVisible();
      await expect(nav.locator('img')).toHaveCount(0);
    }
  });

  test('the flow pulses rest at alpha .9 (the links gate) and fade .9 · nodeFade on scroll — one .9, never two', async ({ page }) => {
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    // effective alpha = stroke-opacity (the 'links' gate, .9) × style.opacity (the scroll fade) = the prototype's single `.9 · nodeFade` (line 332)
    const alphas = () => page.evaluate(() => Array.from(document.querySelectorAll<SVGPathElement>('.cs-stage svg path')).filter((p) => /cs-flow/.test(getComputedStyle(p).animationName)).map((p) => parseFloat(p.getAttribute('stroke-opacity') ?? '1') * parseFloat(p.style.opacity || '1')));
    let a = await alphas();
    expect(a).toHaveLength(3);
    for (const x of a) expect(x).toBeCloseTo(.9, 3);
    await scrollTrack(page, .6);
    await expect.poll(() => progress(page), { timeout: 5_000 }).toBeCloseTo(.6, 3);
    a = await alphas();
    for (const x of a) expect(x, '.9 · (1 − (.6 − .55) / .12)').toBeCloseTo(.525, 2);
  });

  test('form: the field keeps the hover border while it posts (prototype line 19 — :hover outranks :disabled)', async ({ page }) => {
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    const sim = await page.getByText('Prototip UI/UX — asnjë email nuk regjistrohet.').count();
    test.skip(sim === 0, 'VITE_SUBSCRIBE_URL is set — the live endpoint decides how long the field is busy');
    const input = page.locator('.cs-stage input[name="email"]');
    await input.fill('test.gabim@domain.com');
    await page.getByRole('button', { name: 'Më njofto' }).click();
    await expect(input).toBeDisabled(); // busy for 900ms
    await input.hover({ force: true });
    await expect(input).toHaveCSS('border-color', 'rgb(196, 200, 187)'); // #C4C8BB, not the disabled gray-300
  });

  test('reduced motion: Esc before ready only releases — it never skips the intro nor writes the seen flag (line 438: ready = !full || …)', async ({ page }) => {
    await boot(page, 'motion=reduced&visit=first&canvas=d');
    await page.keyboard.press('Escape'); // inside the fonts.ready + 500ms window before play() reaches 'ready' at 60ms
    await page.waitForTimeout(1_200);
    expect(await page.evaluate(() => { try { return localStorage.getItem('nyja-cs-intro'); } catch { return null; } })).toBeNull();
    expect(await phase(page)).toBe('ready');
    // so the next full-motion load is still a first visit
    await boot(page, 'motion=full&canvas=d&tourms=30000');
    expect(await page.evaluate(() => (window as W).__nyja!.visit)).toBe('first');
  });

  test('the scroll position is kept in design px: resizes and tablet rotations never move the progress', async ({ page }) => {
    const resize = async (w: number, h: number) => { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(120); };
    const target = async () => (await snap(page)).target;
    await boot(page, 'motion=full&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    await scrollTrack(page, .4);
    await expect.poll(target).toBeCloseTo(.4, 3);
    // s changes both ways — scrollTop is CSS px, so it must follow s (scrollTop rounds to whole px: precision 2)
    for (const [w, h] of [[1920, 1080], [1000, 700], [1300, 700], [900, 600], [1440, 900]]) { await resize(w, h); expect(await target(), w + '×' + h).toBeCloseTo(.4, 2); }
    // tablet rotation (the desktop canvas is forced, no re-mount): the browser clamps scrollTop against the OLD track before the track grows — the resize listener restores it first
    await resize(1024, 768);
    await scrollTrack(page, .5);
    await expect.poll(target).toBeCloseTo(.5, 2);
    await resize(768, 1024);
    expect(await target(), 'rotation').toBeCloseTo(.5, 2);
    await resize(1024, 768);
    expect(await target(), 'rotation back').toBeCloseTo(.5, 2);
    // a taller viewport with the same (width-bound) s: the end of the track must not be clamped short
    await resize(1000, 700);
    await scrollTrack(page, 1);
    await expect.poll(target).toBe(1);
    await resize(1000, 800);
    expect(await target(), 'taller, width-bound').toBe(1);
    // reduced motion: the rotation must not flip the 50 % snap
    await resize(1024, 768);
    await boot(page, 'motion=reduced&visit=returning&canvas=d');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('ready');
    await scrollTrack(page, .4);
    await expect.poll(target).toBeCloseTo(.4, 2);
    expect(await progress(page)).toBe(0);
    await resize(768, 1024);
    expect(await target()).toBeCloseTo(.4, 2);
    expect(await progress(page)).toBe(0);
  });
});
