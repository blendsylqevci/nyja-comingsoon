// UI copy in both languages. Albanian is the primary language and is the prototype's copy, verbatim (design rules: "Albanian is the primary UI
// language; English is a switch (SQ · EN), never duplicate copy"). The English copy was written for the footer switch on 2026-10-16 and is NOT in
// the prototype — it awaits the designer's review, the statement ("Everything / Connects.") above all. Place names in English follow the English
// Wikipedia titles (Pristina, Skopje, Tirana, Gjakova, Peja, Mitrovica, Struga, Ohrid, Bitola, Kumanovo, Tetovo); the others have no exonym.
export type Lang = 'sq' | 'en';
export const LANGS: readonly Lang[] = ['sq', 'en'];
/** localStorage key written by the footer switch; absent = Albanian. `?lang=` overrides for the session without writing it (QA, shared links). */
export const LANG_KEY = 'nyja-cs-lang';

export interface Copy {
  /** document.title and the meta description (index.html carries the Albanian ones for the no-JS / crawler case). */
  title: string; description: string;
  comingSoon: string; skip: string;
  /** The statement, two lines; the period is the page's `dot` (the Stage colours it in material). */
  statement: [string, string];
  cue: string; cueAria: string; knotAria: string;
  badgesAria: string; appleAria: string; googleAria: string; applePill: string; googlePill: string;
  formTitle: string; formText: string; emailLabel: string; emailPlaceholder: string; cta: string; ctaBusy: string; emailError: string;
  done: [string, string]; fail: [string, string]; retry: string;
  /** The privacy line (ends with a space — the simulation note follows it when no endpoint is configured). */
  privacy: string; simNote: string;
  copyright: string; replay: string; privacyLink: string;
  /** Suffix of a pinned capital's accessible name. */
  selected: string;
  /** Accessible names of the two switch items, each in its own language. */
  langName: Record<Lang, string>;
}

export const COPY: Record<Lang, Copy> = {
  sq: {
    title: 'NYJA — Së shpejti', description: 'GJITHÇKA LIDHET. NYJA po vjen së shpejti — bëhu i pari që lidhet.',
    comingSoon: 'Coming soon', skip: 'Kalo hyrjen',
    statement: ['Gjithçka', 'Lidhet'],
    cue: 'Lëviz për të lidhur', cueAria: 'Lëviz poshtë për të lidhur', knotAria: 'NYJA — lidhja është formuar. Shtyp për ta hapur përsëri.',
    badgesAria: 'Aplikacioni NYJA', appleAria: 'Download on the App Store — së shpejti', googleAria: 'Get it on Google Play — së shpejti', applePill: 'App Store — së shpejti', googlePill: 'Google Play — së shpejti',
    formTitle: 'Bëhu i pari që lidhet.', formText: 'Regjistro emailin dhe mëso i pari kur NYJA të jetë gati.', emailLabel: 'Email adresa', emailPlaceholder: 'emri@domain.com', cta: 'Më njofto', ctaBusy: 'Po dërgohet…', emailError: 'Shkruaj një email të vlefshëm, p.sh. emri@domain.com',
    done: ['U regjistrove me sukses.', 'Do të të njoftojmë kur NYJA të lansohet.'], fail: ['Nuk arritëm ta regjistrojmë emailin.', 'Provo përsëri.'], retry: 'Provo përsëri',
    privacy: 'Emaili përdoret vetëm për njoftimin e lansimit. ', simNote: 'Prototip UI/UX — asnjë email nuk regjistrohet.',
    copyright: '© 2026 NYJA', replay: 'Luaje hyrjen përsëri', privacyLink: 'Privatësia',
    selected: ' — e zgjedhur',
    langName: { sq: 'Shqip', en: 'English' },
  },
  en: {
    title: 'NYJA — Coming soon', description: 'EVERYTHING CONNECTS. NYJA is coming soon — be the first to connect.',
    comingSoon: 'Coming soon', skip: 'Skip intro',
    statement: ['Everything', 'Connects'],
    cue: 'Scroll to connect', cueAria: 'Scroll down to connect', knotAria: 'NYJA — the connection is made. Press to open it again.',
    badgesAria: 'The NYJA app', appleAria: 'Download on the App Store — coming soon', googleAria: 'Get it on Google Play — coming soon', applePill: 'App Store — coming soon', googlePill: 'Google Play — coming soon',
    formTitle: 'Be the first to connect.', formText: 'Leave your email and be the first to know when NYJA is ready.', emailLabel: 'Email address', emailPlaceholder: 'name@domain.com', cta: 'Notify me', ctaBusy: 'Sending…', emailError: 'Enter a valid email address, e.g. name@domain.com',
    done: ['You are on the list.', 'We will let you know when NYJA launches.'], fail: ['We could not register your email.', 'Please try again.'], retry: 'Try again',
    privacy: 'Your email is used only for the launch notification. ', simNote: 'UI/UX prototype — no email is registered.',
    copyright: '© 2026 NYJA', replay: 'Replay the intro', privacyLink: 'Privacy',
    selected: ' — selected',
    langName: { sq: 'Shqip', en: 'English' },
  },
};

/** Albanian → English place names (capitals, countries, tour stops); the same pairs in upper case for the labels (CAPS.label, CLABELS, the tour's `st.label`). */
const EN_PLACES: [string, string][] = [
  ['Prishtinë', 'Pristina'], ['Shkup', 'Skopje'], ['Tiranë', 'Tirana'],
  ['Kosovë', 'Kosovo'], ['Shqipëri', 'Albania'], ['Maqedonia e Veriut', 'North Macedonia'],
  ['Gjakovë', 'Gjakova'], ['Pejë', 'Peja'], ['Mitrovicë', 'Mitrovica'], ['Strugë', 'Struga'], ['Ohër', 'Ohrid'], ['Manastir', 'Bitola'], ['Kumanovë', 'Kumanovo'], ['Tetovë', 'Tetovo'],
];
const EN_PLACE = new Map<string, string>();
for (const [sq, en] of EN_PLACES) { EN_PLACE.set(sq, en); EN_PLACE.set(sq.toUpperCase(), en.toUpperCase()); }
/** A place name in the given language, in the prototype's case; names without an English exonym stay as they are (Gjilan, Prizren, Durrës, Kukës …). */
export const placeName = (lang: Lang, sq: string): string => (lang === 'en' ? EN_PLACE.get(sq) ?? sq : sq);
