// h.mjs — tiny HTML helpers shared by every renderer. No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const IMAGES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'content', 'images.json'), 'utf8'));
// lanes register their own derivatives in src/content/images.d/<lane>.json (same shape); a duplicate key is an error
{
  const dir = path.join(ROOT, 'src', 'content', 'images.d');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const extra = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const [k, v] of Object.entries(extra)) { if (k.startsWith('_')) continue; if (IMAGES[k]) throw new Error(`images.d/${f}: key ${k} already exists`); IMAGES[k] = v; }
  }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const attrs = (o) => Object.entries(o).filter(([, v]) => v !== false && v != null).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join('');

/** A heading text with its accent word wrapped. `t` is a string or { text, accent } (accent must occur in text). */
export function accent(t) {
  if (t == null) return '';
  if (typeof t === 'string') return esc(t);
  const { text, accent: a } = t;
  if (!a) return esc(text);
  const i = text.indexOf(a);
  if (i < 0) throw new Error(`accent "${a}" not in "${text}"`);
  return esc(text.slice(0, i)) + `<span class="accent">${esc(a)}</span>` + esc(text.slice(i + a.length));
}

/** Relative link from the page being built to a site path ('' = home, 'about/', 'shop/?dtche[category]=flower', '#id'). */
export function makeLink(pagePath) {
  const depth = pagePath === '404.html' ? 0 : (pagePath.match(/\//g) || []).length;
  const up = depth ? '../'.repeat(depth) : './';
  return (to) => {
    if (to == null) return '#';
    if (/^(https?:|mailto:|tel:|#)/.test(to)) return to;
    if (to === '' || to === '/') return up;
    return up + to.replace(/^\//, '');
  };
}

/** <img> from images.json keys. `keys` = one key or an array of width variants of the same picture (smallest first). */
export function img(keys, { link, alt, sizes, eager = false, cls, fetchpriority, decorative = false, width, height } = {}) {
  const list = (Array.isArray(keys) ? keys : [keys]).map((k) => { const v = IMAGES[k]; if (!v) throw new Error('unknown image ' + k); return v; });
  const big = list[list.length - 1];
  const src = link(big.file);
  const srcset = list.length > 1 ? list.map((v) => `${link(v.file)} ${v.w}w`).join(', ') : null;
  const a = decorative ? '' : (alt ?? big.alt ?? '');
  return `<img${attrs({ src, srcset, sizes: srcset ? (sizes || '100vw') : null, width: width ?? big.w, height: height ?? big.h, alt: a,
    loading: eager ? null : 'lazy', decoding: 'async', fetchpriority: fetchpriority || null, class: cls || null, 'aria-hidden': decorative ? 'true' : null })}>`;
}

// ---- inline icons (stroke icons, 24 grid; aria-hidden; colour = currentColor)
const P = {
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bag: '<path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.3 6.3a1.5 1.5 0 0 1-2.1 0l-8.6-8Z"/><circle cx="8" cy="8" r="1.4"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="M8 5.5v13l10-6.5-10-6.5Z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4.5 7 7.5 6 7.5-6"/>',
  map: '<path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2Z"/><path d="M9 4.5v13M15 6.5v13"/>',
  truck: '<path d="M3 6.5h11v9H3zM14 9.5h3.6l3 3.2v2.8H14z"/><circle cx="7" cy="17" r="1.8"/><circle cx="17.5" cy="17" r="1.8"/>',
  car: '<path d="M5 15.5V12l1.8-4.2A2 2 0 0 1 8.6 6.5h6.8a2 2 0 0 1 1.8 1.3L19 12v3.5"/><path d="M3.5 15.5h17v2.5h-17z"/><circle cx="7.5" cy="15.5" r=".5"/><path d="M5 12h14"/>',
  store: '<path d="M4 9.5 5.5 4.5h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 11.5v8h13v-8M10 19.5v-5h4v5"/>',
  spark: '<path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2Z"/>',
  cap: '<path d="m2.5 9.5 9.5-4.5 9.5 4.5-9.5 4.5-9.5-4.5Z"/><path d="M6.5 11.5V16c1.7 1.6 3.6 2.4 5.5 2.4s3.8-.8 5.5-2.4v-4.5M21.5 9.5V15"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 14-14-.5 9-6 14-14 14Z"/><path d="M5 19 13 11"/>',
  shield: '<path d="M12 3.5 19 6v5.8c0 4.4-3 7.6-7 8.7-4-1.1-7-4.3-7-8.7V6l7-2.5Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  star: '<path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7L12 4Z"/>',
  users: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.2c2.3.2 4 1.8 4.6 4.8"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18v3H3zM12 9v11M12 9S9.5 4 7.6 5.6C6 7 9 9 12 9Zm0 0s2.5-5 4.4-3.4C18 7 15 9 12 9Z"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5 12 4Z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
  phone: '<path d="M7 3.5h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2C10.6 18.4 5.6 13.4 5 6.7a2 2 0 0 1 2-3.2Z"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10"/>',
};
export const icon = (name, cls = '') => {
  if (!P[name]) throw new Error('unknown icon ' + name);
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name]}</svg>`;
};

/** Particles: n dots with deterministic positions (no randomness: builds are byte-reproducible). */
export function particles(n = 18) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = (i * 37 + 11) % 100, s = 2 + (i * 7) % 3, d = -((i * 2.3) % 18).toFixed(1), t = 14 + (i * 5) % 11, dx = ((i % 5) - 2) * 14;
    out += `<i style="--x:${x}%;--s:${s}px;--d:${d}s;--t:${t}s;--dx:${dx}px"></i>`;
  }
  return `<div class="particles" aria-hidden="true">${out}</div>`;
}
