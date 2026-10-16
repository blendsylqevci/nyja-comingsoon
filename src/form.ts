// The launch-notification form — the design-system Input + Button markup built by hand (bundle: Field/Input lines 372–412, Button lines 30–49)
// with the eight states of the approved design (NYJA-ComingSoon-Desktop-v1.1.dc.html lines 57–67 desktop · 100–101 mobile, logic lines 290–295):
// default · hover · focus · typing (CSS / native) · invalid · submitting · success · error.
import { EMAIL_RE } from './config';

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined>;

/** Tiny element builder: attributes as given (`true` → empty attribute, null/false skipped), children appended in order. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (attrs) for (const k of Object.keys(attrs)) { const v = attrs[k]; if (v == null || v === false) continue; e.setAttribute(k, v === true ? '' : String(v)); }
  for (const c of children) if (c != null && c !== false) e.append(c);
  return e;
}

export interface FormOptions {
  /** id of the email input (the label's `for`). */
  id: string;
  /** 'row' = desktop (input + md button side by side, button cell padded 26px to align with the input) · 'stack' = mobile (full-width lg button). */
  layout: 'row' | 'stack';
  /** VITE_SUBSCRIBE_URL — undefined = simulate (900ms; an address containing "gabim" fails). */
  endpoint: string | undefined;
  /** id of the privacy line → the input's aria-describedby. */
  privacyId: string;
}
export interface FormApi { destroy(): void }

type Status = 'idle' | 'busy' | 'done' | 'fail';
const ERROR_MSG = 'Shkruaj një email të vlefshëm, p.sh. emri@domain.com';
/** Simulated round trip when no endpoint is configured (prototype line 294). */
const SIM_MS = 900;

export function mountForm(host: HTMLElement, opts: FormOptions): FormApi {
  const { id, layout, endpoint, privacyId } = opts;
  const row = layout === 'row';
  let status: Status = 'idle', email = '', error: string | null = null;
  let timer: number | undefined, alive = true, seq = 0;
  let input: HTMLInputElement | null = null, button: HTMLButtonElement | null = null, field: HTMLElement | null = null, errEl: HTMLElement | null = null;

  // invalid: aria-invalid + .ny-input--error on the input and the DS error line under it; typing clears it (frame() line 481).
  const setError = (msg: string | null) => {
    error = msg;
    if (!input || !field) return;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    input.classList.toggle('ny-input--error', !!msg);
    if (msg) { if (!errEl) { errEl = h('span', { class: 'ny-field__error' }); field.append(errEl); } errEl.textContent = msg; }
    else if (errEl) { errEl.remove(); errEl = null; }
  };
  // submitting: input + button disabled, the CTA reads "Po dërgohet…" (line 480).
  const setBusy = (busy: boolean) => {
    if (input) input.disabled = busy;
    if (button) { button.disabled = busy; button.textContent = busy ? 'Po dërgohet…' : 'Më njofto'; }
  };

  const finish = (st: Status, mine: number) => { if (!alive || mine !== seq) return; status = st; render(); };
  const submit = (e: Event) => {
    e.preventDefault();
    if (status === 'busy') return;
    if (!EMAIL_RE.test(email)) { setError(ERROR_MSG); return; }
    setError(null); status = 'busy'; setBusy(true);
    const mine = ++seq;
    if (endpoint) {
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, locale: 'sq', source: 'coming-soon' }) })
        .then(res => finish(res.ok ? 'done' : 'fail', mine), () => finish('fail', mine));
    } else {
      timer = window.setTimeout(() => finish(/gabim/i.test(email) ? 'fail' : 'done', mine), SIM_MS);
    }
  };

  // idle / busy: the form (lines 59–62 desktop · 100–101 mobile) — the same elements stay while the status changes, so focus is kept.
  const renderIdle = () => {
    errEl = null;
    const inp = h('input', { id, class: 'ny-input', type: 'email', name: 'email', placeholder: 'emri@domain.com', autocomplete: 'email', 'aria-invalid': 'false', 'aria-describedby': privacyId });
    inp.value = email;
    inp.addEventListener('input', () => { email = inp.value; if (error) setError(null); });
    input = inp;
    field = h('div', { class: 'ny-field' }, h('label', { class: 'ny-field__label', for: id }, 'Email adresa'), inp);
    button = h('button', { type: 'submit', class: row ? 'ny-btn ny-btn--secondary ny-btn--md' : 'ny-btn ny-btn--secondary ny-btn--lg ny-btn--full' }, 'Më njofto');
    const form = row
      ? h('form', { class: 'cs-form-row' }, h('div', { class: 'cs-form-row__f' }, field), h('div', { class: 'cs-form-row__b' }, button))
      : h('form', { class: 'cs-form-stack' }, h('div', { class: 'cs-form-stack__f' }, field), h('div', { class: 'cs-form-stack__b' }, button));
    form.noValidate = true;
    form.addEventListener('submit', submit);
    host.replaceChildren(form);
    if (error) setError(error);
    setBusy(status === 'busy');
  };
  // success (line 64): 8px material node + the confirmation, announced politely.
  const doneView = () => h('div', { class: 'cs-form-status', role: 'status', 'aria-live': 'polite' },
    h('span', { class: 'cs-form-node', 'aria-hidden': 'true' }),
    h('span', { class: 'cs-form-msg' }, 'U regjistrove me sukses.', h('br'), 'Do të të njoftojmë kur NYJA të lansohet.'));
  // error (line 65): hollow danger node + the message + the outline retry button → back to idle, keeping the address.
  const failView = () => {
    const retry = h('button', { type: 'button', class: 'ny-btn ny-btn--outline ny-btn--sm' }, 'Provo përsëri');
    retry.addEventListener('click', () => { status = 'idle'; render(); input?.focus(); });
    return h('div', { class: 'cs-form-status', role: 'alert' },
      h('span', { class: 'cs-form-node cs-form-node--fail', 'aria-hidden': 'true' }),
      h('span', { class: 'cs-form-msg cs-form-msg--grow' }, 'Nuk arritëm ta regjistrojmë emailin.', h('br'), 'Provo përsëri.'),
      h('div', { class: 'cs-form-retry' }, retry));
  };
  const render = () => {
    if (status === 'done' || status === 'fail') { input = null; button = null; field = null; errEl = null; host.replaceChildren(status === 'done' ? doneView() : failView()); }
    else renderIdle();
  };
  render();

  return { destroy() { alive = false; seq++; clearTimeout(timer); host.replaceChildren(); } };
}
