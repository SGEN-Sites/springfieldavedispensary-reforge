#!/usr/bin/env node
// check.mjs - the RENDERED gate (lane T2) for the Springfield Ave Dispensary build. In a real headless Chromium, at
// each viewport, it proves the brief's layout rules (R1-R10) and that the interactive parts work (F1-F10).
//
// USAGE (always through the 2-slot browser lock; it refuses to start without it unless --unlocked):
//   sh src/tools/browser-lock.sh node src/tools/check.mjs [--dir dist] [--paths home,about/,shop/ | --all]
//        [--vp 1440x900,390x844 | --vp all] [--json audit/check/<name>.json] [--name <name>] [--only R1,F2]
//        [--shots] [--shots-dir audit/shots] [--allow-third-party] [--site src/content/site.json]
//        [--watchdog <seconds>] [--unlocked]
//   --paths  'home' = the site root; others as in site.json (about/, shop/flower/, 404.html). --all = every site.json page.
//   --vp     default 1440x900,1280x720,1024x768,768x1024,390x844,360x740; 'all' adds 1920x1080,2560x1300,1440x1300,
//            430x932,375x667,1180x820.
//   --shots  saves audit/shots/<page>/<vp>.png (viewport at the top of the page, gate pre-answered).
//   Every request that is not to the in-process server (127.0.0.1, port 0) is ABORTED and recorded (third party),
//   unless --allow-third-party. Fonts are self-hosted, so they load.
//
// LAYOUT RULES (reducedMotion 'reduce', localStorage 'sad-age-verified' pre-seeded so the 21+ gate is closed):
//   R1  no horizontal page scroll; no visible element box past the right edge unless an overflow / clip ancestor
//       (other than html/body) clips it. aria-hidden decoration is not judged.
//   R2  section.hero[data-hero] (required on home): first main > section; bottom <= innerHeight + 1 at viewports
//       >= 360x640; [data-primary-cta] fully inside the viewport and not covered (elementFromPoint at its centre).
//   R3  main > section height <= 1.15 x innerHeight at >= 1024 wide, <= 2.2 x below ("endless section");
//       data-tall="<reason>" opts a section out (reported, not failed).
//   R4  tap targets >= 44x44 below 768 wide (a, button, input, select, textarea, summary, [role=button|tab]);
//       an <a> whose p/li has text outside the link is exempt (inline link).
//   R5  contrast on REAL PIXELS: text colours recorded, all text hidden, each section scrolled under the header,
//       viewport screenshots, the brightest 10% (light text) / darkest 10% (dark text) of the pixels in each text
//       rect vs the text colour (alpha composited). >= 4.5:1, >= 3:1 for >= 24px or >= 18.66px bold. Gradient text
//       (background-clip:text) = its worst stop. Sticky / fixed text (header, dock) = worst over every position.
//       aria-hidden text is decorative (measured, reported, not failed); disabled controls are exempt. Worst 10 kept.
//   R6  every <img>: width + height + alt attributes; loaded after scrolling into view; not distorted (> 3%) unless
//       object-fit is not 'fill'.
//   R7  exactly one h1 (rendered headings); heading levels never skip downward.
//   R8  running text (p, li, dd with >= 60 chars) >= 15px at >= 768 wide, >= 14px below; no visible text < 11px.
//   R9  0 console errors / page errors and 0 failed same-origin requests (third-party aborts recorded, not failed).
//   R10 Tab from the top: the first stop is a.skip-link[href="#main"] (shown on focus); each of the next 25 stops
//       shows a focus indicator (outline > 0 with a visible colour, or a box-shadow change vs unfocused).
// FUNCTIONAL (at 1440x900 and 390x844 when they are in --vp; F2 at every --vp below 1100 wide; F3 at 390x844):
//   F1  age gate on a fresh visit (reduce AND motion-on): visible, focus inside, Tab trapped, Yes closes + stores
//       sad-age-verified {v:1,at}, reload => no gate; No => navigation to https://google.com (intercepted).
//   F2  drawer: .menu-toggle opens #drawer (aria-expanded, visible, has [data-status] text + [data-shop-now]),
//       the page does not scroll while open, Escape closes it and focus returns to the toggle.
//   F3  after scrolling 2.5 screens at 390x844 a visible shop/ link sits in the viewport (header or nav.dock).
//   F4  motion-on: animations running; the pause button => html[data-motion=paused], aria-pressed=true, every
//       animation paused/finished, no video playing, persists after reload (sad-motion). Reduce: no infinite one.
//   F5  each visible [data-carousel] whose [data-rail] overflows: [data-next] scrolls it, [data-prev] disabled at the
//       start, controls >= 44px at phone width.
//   F6  clock 2026-11-04 12:00 EST => exactly one [data-day][data-today] = "3"; 2026-11-08 23:30 => "0".
//   F7  header [data-status] at fixed New York times (live wording: Open Now / Closes in N min / Open until 8PM /
//       Closed / Opens today at 9AM / Opens tomorrow at 10AM).
//   F8  each form[data-api]: required fields filled, endpoint mocked 200 => JSON body with the live keys + site "sfd",
//       [data-form-status] (aria-live=polite) shows a message; mocked 500 => an error message shown.
//   F9  reduce => every [data-reveal] opacity 1 at load; motion-on => each reaches opacity 1 within 4 s in view.
//   F10 each [data-day] opens dialog#deal-<day> as a modal and Escape closes it.
// Every check reports how many items it measured; a check that measured 0 items is a FAIL. Status per check:
// PASS / FAIL / n/a (its hook is absent on that page) / skip (viewport out of its scope). A requested check that
// never ran at any viewport is a FAIL.
// OUTPUT: a page x viewport table, details, audit/check/<name>.json. EXIT 0 = no FAIL, 1 = FAIL, 2 = usage / not under
// the lock, 3 = watchdog. Self-test: sh src/tools/browser-lock.sh node src/tools/check-selftest.mjs
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import zlib from 'node:zlib';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const die = (code, msg) => { console.error('check: ' + msg); process.exit(code); };

const RULES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10'];
const ONLY = opt('only', '') ? opt('only', '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : null;
if (ONLY) for (const r of ONLY) if (!RULES.includes(r)) die(2, `unknown rule "${r}" in --only (known: ${RULES.join(',')})`);
const want = (id) => !ONLY || ONLY.includes(id);
if (!process.env.BROWSER_LOCK_SLOT && !has('unlocked')) die(2, 'run me through the browser lock: sh src/tools/browser-lock.sh node src/tools/check.mjs ... (or pass --unlocked)');

const DIR = path.resolve(ROOT, opt('dir', 'dist'));
if (!fs.existsSync(DIR) || !fs.statSync(DIR).isDirectory()) die(2, `--dir ${DIR} does not exist`);
const SITE_FILE = path.resolve(ROOT, opt('site', 'src/content/site.json'));
let PATHS;
if (has('all')) { PATHS = JSON.parse(fs.readFileSync(SITE_FILE, 'utf8')).pages.map((p) => p.path); }
else PATHS = opt('paths', 'home').split(',').map((p) => p.trim()).filter((p) => p.length).map((p) => (p === 'home' || p === '/' ? '' : p.replace(/^\//, '')));
if (!PATHS.length) die(2, 'no pages given');
const pageKey = (p) => (p === '' ? 'home' : p.replace(/\/index\.html$/, '').replace(/\/$/, '').replace(/\.html$/, '').replace(/\//g, '-'));
const DEF_VP = '1440x900,1280x720,1024x768,768x1024,390x844,360x740';
const EXTRA_VP = '1920x1080,2560x1300,1440x1300,430x932,375x667,1180x820';
const vpArg = opt('vp', DEF_VP);
const VPS = (vpArg === 'all' ? DEF_VP + ',' + EXTRA_VP : vpArg).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
  const m = /^(\d+)x(\d+)$/.exec(s); if (!m) die(2, `bad viewport "${s}" (want WxH)`); return { w: +m[1], h: +m[2], key: s };
});
const FUNC_VPS = new Set(['1440x900', '390x844']);
const NAME = opt('name', has('all') ? 'all' : PATHS.map(pageKey).join('+').slice(0, 60));
const OUT = path.resolve(ROOT, opt('json', `audit/check/${NAME}.json`));
const SHOTS = has('shots'); const SHOTS_DIR = path.resolve(ROOT, opt('shots-dir', 'audit/shots'));
const ALLOW_3P = has('allow-third-party');
const WATCHDOG_S = +opt('watchdog', String(Math.min(7200, 240 + PATHS.length * VPS.length * 150)));
const { chromium } = require(process.env.PW_CORE || '/Users/carlcelino/OSOFT/.claude/skills/client-site-build/scripts/node_modules/playwright-core');

// ---------------------------------------------------------------- report + watchdog
const report = { tool: 'check.mjs', at: new Date().toISOString(), dir: path.relative(ROOT, DIR) || '.', lockSlot: process.env.BROWSER_LOCK_SLOT || null,
  only: ONLY, viewports: VPS.map((v) => v.key), paths: PATHS, allowThirdParty: ALLOW_3P, runs: [], summary: null, aborted: null };
let STEP = 'starting';
const writeReport = () => { try { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(report, null, 1)); } catch (e) { console.error('check: could not write ' + OUT + ': ' + e.message); } };
setTimeout(() => {
  report.aborted = `watchdog: exceeded ${WATCHDOG_S} s during "${STEP}"`;
  writeReport();
  console.error(`check: WATCHDOG - exceeded ${WATCHDOG_S} s during "${STEP}" (machine load?). Ended with exit 3; partial report ${path.relative(ROOT, OUT)}`);
  process.exit(3);
}, WATCHDOG_S * 1000).unref();

// ---------------------------------------------------------------- static server (port 0)
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); } catch (e) { res.writeHead(400); res.end(); return; }
  let f = path.join(DIR, p);
  if (f !== DIR && !f.startsWith(DIR + path.sep)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { location: p + '/' }); res.end(); return; }
    f = path.join(f, 'index.html');
  }
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// ---------------------------------------------------------------- PNG reader + WCAG maths
function readPng(buf) {
  let p = 8, w = 0, h = 0, ct = 0, bd = 8; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; } else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error(`unsupported PNG (bit depth ${bd}, colour type ${ct})`);
  const bpp = ct === 6 ? 4 : 3; const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * bpp; const out = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const ro = y * (stride + 1) + 1; const oo = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[oo + x - bpp] : 0, b = y ? out[oo - stride + x] : 0, c = x >= bpp && y ? out[oo - stride + x - bpp] : 0; let v = raw[ro + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[oo + x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}
const chan = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b);
const ratioL = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('') + (c.a !== undefined && c.a < 1 ? `/${(+c.a).toFixed(2)}` : '');
function sampleBg(png, rects) {
  let area = 0; for (const [l, t, r, b] of rects) area += Math.max(0, r - l) * Math.max(0, b - t);
  const step = area > 90000 ? 3 : area > 30000 ? 2 : 1;
  const L = []; const C = [];
  for (const [l, t, r, b] of rects) {
    const x0 = Math.max(0, Math.floor(l)), x1 = Math.min(png.w, Math.ceil(r)), y0 = Math.max(0, Math.floor(t)), y1 = Math.min(png.h, Math.ceil(b));
    for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) { const o = (y * png.w + x) * png.bpp; const c = { r: png.px[o], g: png.px[o + 1], b: png.px[o + 2] }; L.push(lum(c)); C.push(c); }
  }
  if (!L.length) return null;
  const idx = Uint32Array.from(L.keys()).sort((a, b) => L[a] - L[b]);
  const k = Math.max(1, Math.round(L.length * 0.1));
  const mean = (from, to) => { let r = 0, g = 0, b = 0; for (let i = from; i < to; i++) { const c = C[idx[i]]; r += c.r; g += c.g; b += c.b; } const n = to - from; return { r: r / n, g: g / n, b: b / n }; };
  return { n: L.length, dark: mean(0, k), bright: mean(L.length - k, L.length), medL: L[idx[Math.floor(L.length / 2)]] };
}
function rate(m, s) {
  const comp = (c, bg) => { const a = Math.max(0, Math.min(1, (c.a === undefined ? 1 : c.a) * m.op)); return { r: c.r * a + bg.r * (1 - a), g: c.g * a + bg.g * (1 - a), b: c.b * a + bg.b * (1 - a) }; };
  if (m.stops) {
    const avg = m.stops.reduce((t, c) => t + lum(c), 0) / m.stops.length; const light = avg >= s.medL; const bg = light ? s.bright : s.dark; const bl = lum(bg);
    let worst = null;
    for (const c of m.stops) { const r = ratioL(lum(comp(c, bg)), bl); if (!worst || r < worst.r) worst = { r, c }; }
    const ls = m.stops.map(lum); const wl = lum(worst.c); const which = wl >= Math.max(...ls) - 1e-9 ? 'lightest' : wl <= Math.min(...ls) + 1e-9 ? 'darkest' : 'middle';
    return { ratio: worst.r, fg: hex(worst.c), bg: hex(bg), how: `gradient text: ${which} of ${m.stops.length} stops vs ${light ? 'brightest' : 'darkest'} 10% of background` };
  }
  const light = lum(m.fg) >= s.medL; const bg = light ? s.bright : s.dark;
  return { ratio: ratioL(lum(comp(m.fg, bg)), lum(bg)), fg: hex(m.fg), bg: hex(bg), how: `${light ? 'light' : 'dark'} text vs ${light ? 'brightest' : 'darkest'} 10% of ${s.n} background px` };
}

// ---------------------------------------------------------------- in-page helpers (installed after every navigation)
function CK() {
  if (window.__ck) return;
  const vis = (el) => {
    if (!el || !el.isConnected || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true });
    for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || +s.opacity === 0) return false; }
    return getComputedStyle(el).visibility !== 'hidden';
  };
  const desc = (el) => {
    if (!el || !el.tagName) return String(el);
    const id = el.id ? '#' + el.id : '';
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((c) => '.' + c).join('');
    const at = ['data-day', 'data-primary-cta', 'data-carousel', 'data-rail', 'data-api', 'href'].find((a) => el.hasAttribute(a));
    const atS = at ? `[${at}${el.getAttribute(at) ? '="' + el.getAttribute(at).slice(0, 40) + '"' : ''}]` : '';
    const t = (el.tagName === 'SECTION' || el.tagName === 'MAIN' || el.tagName === 'BODY' ? (el.getAttribute('aria-label') || (el.querySelector('h1,h2') || {}).textContent || '') : (el.innerText || el.getAttribute('aria-label') || el.getAttribute('alt') || '')).trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls}${atS}${t ? ' "' + t + '"' : ''}`;
  };
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true }); const cache = new Map();
  const color = (s) => {
    if (!s) return null; s = String(s).trim(); if (cache.has(s)) return cache.get(s);
    let out = null; const m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean); const n = (v) => (v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v)); out = { r: n(p[0]), g: n(p[1]), b: n(p[2]), a: p.length > 3 ? (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3])) : 1 }; }
    else if (s === 'transparent') out = { r: 0, g: 0, b: 0, a: 0 };
    else { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#010203'; cx.fillStyle = s; if (cx.fillStyle !== '#010203' || /^#010203$/i.test(s)) { cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; out = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; } }
    cache.set(s, out); return out;
  };
  const clippers = (el) => { const out = []; for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.overflowX !== 'visible' || s.overflowY !== 'visible' || (s.clipPath && s.clipPath !== 'none')) out.push(e); } return out; };
  const overlayOf = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e; } return null; };
  const COLRE = /(rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|oklab\([^)]*\)|lab\([^)]*\)|lch\([^)]*\)|color\([^)]*\)|#[0-9a-fA-F]{3,8}\b)/g;
  window.__ck = { vis, desc, color, clippers, overlayOf, COLRE };
}
const CK_SRC = `(${CK.toString()})()`;
const ck = (page) => page.evaluate(CK_SRC);
async function settle(page) {
  await ck(page);
  await page.evaluate(async () => { try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]); } catch (e) {} await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
}
async function poll(page, fn, ms, arg) {
  const t0 = Date.now(); let v;
  do { v = await page.evaluate(fn, arg).catch(() => false); if (v) return v; await page.waitForTimeout(60); } while (Date.now() - t0 < ms);
  return v;
}
const errMsg = (e) => String((e && e.message) || e).split('\n')[0].slice(0, 200);

// ---------------------------------------------------------------- in-page measurers
const measureHero = (isHome) => {
  const { vis, desc } = window.__ck;
  const hero = document.querySelector('section.hero[data-hero]');
  if (!hero) return isHome ? { count: 0, fails: [{ sel: 'main', msg: 'the home page has no section.hero[data-hero]' }] } : { na: 'no section.hero[data-hero] on this page' };
  if (innerWidth < 360 || innerHeight < 640) return { skip: `viewport ${innerWidth}x${innerHeight} is below 360x640` };
  const fails = []; const r = hero.getBoundingClientRect();
  const main = document.querySelector('main'); const first = main && [...main.children].find((c) => c.tagName === 'SECTION');
  if (first !== hero) fails.push({ sel: desc(hero), msg: 'the hero is not the first main > section' });
  if (r.bottom > innerHeight + 1) fails.push({ sel: desc(hero), msg: `hero bottom ${Math.round(r.bottom)}px > innerHeight ${innerHeight}px (+1): taller than the first screen` });
  let n = 1; const cta = hero.querySelector('[data-primary-cta]');
  if (!cta) fails.push({ sel: desc(hero), msg: 'no [data-primary-cta] inside the hero' + (document.querySelector('[data-primary-cta]') ? ' (one exists outside it)' : '') });
  else {
    n++; const c = cta.getBoundingClientRect();
    if (!vis(cta)) fails.push({ sel: desc(cta), msg: 'primary CTA is not visible' });
    else if (c.top < -0.5 || c.left < -0.5 || c.bottom > innerHeight + 0.5 || c.right > innerWidth + 0.5) fails.push({ sel: desc(cta), msg: `CTA box (${Math.round(c.left)},${Math.round(c.top)} ${Math.round(c.width)}x${Math.round(c.height)}) is not fully inside the ${innerWidth}x${innerHeight} viewport` });
    else { const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); if (!hit || !(hit === cta || cta.contains(hit))) fails.push({ sel: desc(cta), msg: `CTA centre is covered by ${hit ? desc(hit) : 'nothing'}` }); }
  }
  return { count: n, fails, notes: [`hero ${Math.round(r.height)}px tall, bottom at ${Math.round(r.bottom)}px of ${innerHeight}px`] };
};

const measureLayout = (w) => {
  const { vis, desc } = window.__ck; const out = {};
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const memo = new Map(); const V = (e) => { if (!memo.has(e)) memo.set(e, vis(e)); return memo.get(e); };
  if (w.R1) {
    const bad = []; let n = 0; const fails = [];
    const sw = document.documentElement.scrollWidth;
    if (sw > vw) fails.push({ sel: 'html', msg: `document scrollWidth ${sw}px > viewport ${vw}px (the page scrolls sideways)` });
    for (const el of document.body.querySelectorAll('*')) {
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|BR|WBR|DIALOG)$/.test(el.tagName) && !(el.tagName === 'DIALOG' && el.open)) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      if (!V(el)) continue; n++;
      const r = el.getBoundingClientRect(); if (r.right <= vw + 1) continue;
      let clipped = false;
      for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX !== 'visible' || (s.clipPath && s.clipPath !== 'none') || /paint|strict|content/.test(s.contain || '')) { if (a.getBoundingClientRect().right <= vw + 1) { clipped = true; break; } }
      }
      if (!clipped) bad.push(el);
    }
    for (const el of bad) if (!bad.some((o) => o !== el && o.contains(el))) fails.push({ sel: desc(el), msg: `box right edge ${Math.round(el.getBoundingClientRect().right)}px is past the viewport's right edge (${vw}px) and no ancestor clips it` });
    out.R1 = { count: n + 1, fails, notes: [`scrollWidth ${sw} / clientWidth ${vw} / innerWidth ${innerWidth}; ${n} visible element boxes checked`] };
  }
  if (w.R3) {
    const secs = [...document.querySelectorAll('main > section')]; const f = vw >= 1024 ? 1.15 : 2.2; const lim = f * vh; const fails = [], notes = [];
    for (const s of secs) {
      const h = s.getBoundingClientRect().height; if (h <= lim + 0.5) continue;
      const t = s.getAttribute('data-tall');
      if (t !== null) notes.push(`${desc(s)} ${Math.round(h)}px > ${f} x ${vh}px, opted out: data-tall="${t}"`);
      else fails.push({ sel: desc(s), msg: `section ${Math.round(h)}px tall > ${f} x innerHeight = ${Math.round(lim)}px${vw >= 1024 ? '' : ' (endless section)'}` });
    }
    out.R3 = { count: secs.length, fails, notes: [`${secs.length} main > section, limit ${Math.round(lim)}px`, ...notes] };
  }
  if (w.R4) {
    if (vw >= 768) out.R4 = { skip: `viewport ${vw}px >= 768 (tap targets are judged on phones)` };
    else {
      let n = 0; const fails = []; let exempt = 0;
      const ownText = (host, link) => { const tw = document.createTreeWalker(host, NodeFilter.SHOW_TEXT); let s = ''; while (tw.nextNode()) if (!link.contains(tw.currentNode)) s += tw.currentNode.nodeValue; return s.trim(); };
      for (const el of document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"]')) {
        if (el.classList.contains('skip-link') || !V(el)) continue;
        if (el.tagName === 'A') { const host = el.parentElement && el.parentElement.closest('p, li'); if (host && ownText(host, el)) { exempt++; continue; } }
        let r = el.getBoundingClientRect();
        if (el.tagName === 'INPUT' && /^(checkbox|radio)$/i.test(el.type)) { const lab = el.closest('label') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)); if (lab && V(lab)) r = lab.getBoundingClientRect(); }
        n++;
        if (r.width < 43.5 || r.height < 43.5) fails.push({ sel: desc(el), msg: `tap target ${r.width.toFixed(0)}x${r.height.toFixed(0)}px (min 44x44)` });
      }
      out.R4 = { count: n, fails, notes: [`${n} targets measured, ${exempt} inline link(s) in running text exempt`] };
    }
  }
  if (w.R7) {
    const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => (h.checkVisibility ? h.checkVisibility() : h.getClientRects().length > 0));
    const fails = []; const h1 = hs.filter((h) => h.tagName === 'H1');
    if (h1.length !== 1) fails.push({ sel: 'h1', msg: `${h1.length} rendered h1 (want exactly 1)${h1.length ? ': ' + h1.map(desc).join(' | ') : ''}` });
    let last = 0; for (const h of hs) { const lv = +h.tagName[1]; if (last && lv > last + 1) fails.push({ sel: desc(h), msg: `heading level skips h${last} -> h${lv}` }); last = lv; }
    out.R7 = { count: hs.length, fails, notes: [`outline: ${hs.map((h) => h.tagName.toLowerCase()).join(' ')}`] };
  }
  if (w.R8) {
    const runMin = vw >= 768 ? 15 : 14; let nRun = 0, nAll = 0; const fails = [];
    for (const el of document.querySelectorAll('p, li, dd')) {
      if (!V(el)) continue; const t = (el.innerText || '').trim(); if (t.length < 60) continue; nRun++;
      const fz = parseFloat(getComputedStyle(el).fontSize); if (fz < runMin - 0.01) fails.push({ sel: desc(el), msg: `running text ${fz}px < ${runMin}px (${t.length} chars)` });
    }
    const seen = new Set(); const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const tn = tw.currentNode; if (!tn.nodeValue.trim()) continue; const el = tn.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
      if (el.closest('script,style,noscript,template,svg,title,option')) continue; if (!V(el)) continue;
      const r = el.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue; nAll++;
      const fz = parseFloat(getComputedStyle(el).fontSize); if (fz < 11 - 0.01) fails.push({ sel: desc(el), msg: `visible text ${fz}px < 11px` });
    }
    out.R8 = { count: nRun + nAll, fails, notes: [`${nRun} running-text block(s) (>= 60 chars) vs ${runMin}px, ${nAll} text element(s) vs 11px`] };
  }
  return out;
};

const measureImages = async () => {
  const { vis, desc } = window.__ck; const fails = []; const imgs = [...document.images]; let checked = 0; const t0 = performance.now();
  const wait = (im, ms) => new Promise((res) => { const s = performance.now(); const tick = () => { if (im.complete && im.naturalWidth > 0) return res(true); if (performance.now() - s > ms) return res(false); setTimeout(tick, 50); }; tick(); });
  const scrollers = new Map();
  for (const im of imgs) {
    const w = im.getAttribute('width'), h = im.getAttribute('height');
    if (!w || !h || !(+w > 0) || !(+h > 0)) fails.push({ sel: desc(im), msg: `missing width/height attribute (width=${w}, height=${h})` });
    if (!im.hasAttribute('alt')) fails.push({ sel: desc(im), msg: 'no alt attribute' });
    if (!vis(im)) continue;
    for (let a = im.parentElement; a && a !== document.body; a = a.parentElement) if (a.scrollWidth > a.clientWidth + 1 && !scrollers.has(a)) scrollers.set(a, a.scrollLeft);
    im.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const ok = await wait(im, performance.now() - t0 > 45000 ? 300 : 4000); checked++;
    if (!ok) { fails.push({ sel: desc(im), msg: `not loaded after scrolling into view (complete=${im.complete}, naturalWidth=${im.naturalWidth}, ${(im.currentSrc || im.src || '').split('/').pop()})` }); continue; }
    const s = getComputedStyle(im);
    if (!s.objectFit || s.objectFit === 'fill') {
      const px = (k) => parseFloat(s[k]) || 0;
      const bw = im.offsetWidth - px('paddingLeft') - px('paddingRight') - px('borderLeftWidth') - px('borderRightWidth');
      const bh = im.offsetHeight - px('paddingTop') - px('paddingBottom') - px('borderTopWidth') - px('borderBottomWidth');
      if (bw > 1 && bh > 1) { const a = bw / bh, n = im.naturalWidth / im.naturalHeight; if (Math.abs(a - n) / n > 0.03) fails.push({ sel: desc(im), msg: `distorted: drawn ${bw}x${bh} (ratio ${a.toFixed(3)}) vs natural ${im.naturalWidth}x${im.naturalHeight} (${n.toFixed(3)}), object-fit ${s.objectFit || 'fill'}` }); }
    }
  }
  for (const [a, x] of scrollers) a.scrollLeft = x;
  scrollTo({ top: 0, behavior: 'instant' });
  return imgs.length ? { count: imgs.length, fails, notes: [`${imgs.length} <img>; ${checked} visible ones scrolled into view and checked loaded / undistorted`] } : { na: 'no <img> on this page' };
};

// R5: collect text runs (before the text is hidden)
const collectText = () => {
  const { vis, desc, color, clippers, overlayOf, COLRE } = window.__ck;
  const items = []; const byEl = new Map(); const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const tn = tw.currentNode; if (!tn.nodeValue.trim()) continue; const el = tn.parentElement; if (!el) continue;
    if (byEl.has(el)) { byEl.get(el).nodes.push(tn); continue; }
    if (el.closest('script,style,noscript,template,svg,title,option,select,textarea')) continue;
    if (!vis(el)) continue; const br = el.getBoundingClientRect(); if (br.width <= 1 || br.height <= 1) continue;
    const it = { el, nodes: [tn] }; byEl.set(el, it); items.push(it);
  }
  const meta = []; const kept = [];
  for (const it of items) {
    const el = it.el; const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400; const large = size >= 24 || (size >= 18.66 && weight >= 700);
    let op = 1; for (let e = el; e && e !== document.documentElement; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    const clip = `${cs.webkitBackgroundClip || ''} ${cs.backgroundClip || ''}`;
    const grad = /text/.test(clip) && cs.backgroundImage && cs.backgroundImage !== 'none';
    let fg = color(cs.webkitTextFillColor) || color(cs.color); let stops = null;
    if (grad) { stops = (cs.backgroundImage.match(COLRE) || []).map(color).filter((c) => c && c.a > 0); if (!stops.length) stops = null; }
    if (!grad && fg && fg.a === 0 && (parseFloat(cs.webkitTextStrokeWidth) || 0) > 0) fg = color(cs.webkitTextStrokeColor);
    if (!stops && (!fg || fg.a === 0)) continue;
    if (grad) el.setAttribute('data-ck-grad', '');
    it.clip = clippers(el); it.ov = overlayOf(el);
    meta.push({ sel: desc(el), text: it.nodes.map((n) => n.nodeValue).join(' ').trim().replace(/\s+/g, ' ').slice(0, 50), size, weight, large, min: large ? 3 : 4.5, fg, stops, op,
      decorative: !!el.closest('[aria-hidden="true"]'), disabled: !!el.closest('button:disabled, input:disabled, [aria-disabled="true"], fieldset:disabled'), overlay: !!it.ov });
    kept.push(it);
  }
  window.__ckT = kept;
  const ovs = [...document.querySelectorAll('body *')].filter((e) => { const p = getComputedStyle(e).position; return (p === 'fixed' || p === 'sticky') && !e.closest('[aria-hidden="true"]') && getComputedStyle(e).pointerEvents !== 'none' && vis(e); });
  window.__ckOv = ovs.filter((e) => !ovs.some((o) => o !== e && o.contains(e)));
  return meta;
};
const r5Positions = () => {
  const { vis } = window.__ck;
  const ovH = (sel) => { const e = document.querySelector(sel); if (!e || !vis(e)) return 0; const p = getComputedStyle(e).position; return p === 'fixed' || p === 'sticky' ? e.getBoundingClientRect().height : 0; };
  const hH = ovH('header.site-header'), dH = ovH('nav.dock'); const band = Math.max(120, innerHeight - hH - dH - 8);
  const max = Math.max(0, document.documentElement.scrollHeight - innerHeight); const P = [0];
  for (const b of document.querySelectorAll('main > section, footer.site-footer')) {
    const r = b.getBoundingClientRect(); const top = r.top + scrollY, bot = top + r.height; let y = top - hH; P.push(y);
    while (y + hH + band < bot) { y += band - 24; P.push(y); }
  }
  P.push(max);
  return [...new Set(P.map((y) => Math.round(Math.max(0, Math.min(max, y)))))].sort((a, b) => a - b).filter((y, i, a) => i === 0 || y - a[i - 1] > 6);
};
const r5Geo = (done) => {
  const T = window.__ckT; const D = new Set(done); const vw = document.documentElement.clientWidth, vh = innerHeight;
  const area = (q) => Math.max(0, q.r - q.l) * Math.max(0, q.b - q.t); const isect = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const ov = window.__ckOv.filter((e) => window.__ck.vis(e)).map((e) => { const r = e.getBoundingClientRect(); return { e, q: { l: r.left, t: r.top, r: r.right, b: r.bottom } }; });
  const res = []; const rng = document.createRange();
  for (let i = 0; i < T.length; i++) {
    const it = T[i]; const isOv = !!it.ov; if ((!isOv && D.has(i)) || !it.el.isConnected) continue;
    let lines = [];
    for (const n of it.nodes) { rng.selectNodeContents(n); for (const r of rng.getClientRects()) if (r.width >= 0.5 && r.height >= 0.5) lines.push({ l: r.left, t: r.top, r: r.right, b: r.bottom }); }
    if (!lines.length) continue;
    const full = lines.reduce((s, q) => s + area(q), 0); const span = Math.max(...lines.map((q) => q.b)) - Math.min(...lines.map((q) => q.t));
    for (const c of it.clip) { const cr = c.getBoundingClientRect(); const q = { l: cr.left, t: cr.top, r: cr.right, b: cr.bottom }; lines = lines.map((x) => isect(x, q)).filter((x) => area(x) > 0); }
    lines = lines.filter((x) => x.t >= -0.5 && x.b <= vh + 0.5).map((x) => isect(x, { l: 0, t: 0, r: vw, b: vh })).filter((x) => area(x) > 0);
    if (!isOv) lines = lines.filter((x) => !ov.some((o) => !o.e.contains(it.el) && area(isect(x, o.q)) > 0));
    // sticky/fixed text can itself slide UNDER another overlay (a sticky filter bar ending under the site header): a line
    // whose centre hit-tests to an unrelated element is not visible at this position, so it is not rated here
    else lines = lines.filter((x) => { const h = document.elementFromPoint((x.l + x.r) / 2, (x.t + x.b) / 2); return !h || it.el.contains(h) || h.contains(it.el); });
    const va = lines.reduce((s, q) => s + area(q), 0);
    if (!lines.length || !(va >= 0.6 * full || (span > 0.6 * vh && va > 0))) continue;
    res.push({ i, rects: lines.map((x) => [x.l, x.t, x.r, x.b]) });
  }
  return res;
};
const HIDE_CSS = `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important;
  -webkit-text-stroke-color: transparent !important; text-decoration-color: transparent !important; caret-color: transparent !important; transition: none !important; }
  [data-ck-grad] { background-image: none !important; } ::placeholder { color: transparent !important; }`;

// ---------------------------------------------------------------- per-run plumbing
function newRun(pg, vp) {
  const V = { page: pg.key, path: pg.path, vp: vp.key, rules: {}, thirdParty: [], notes: [], r5worst: null };
  V.get = (id) => (V.rules[id] ||= { status: null, count: 0, fails: [], notes: [] });
  V.fail = (id, sel, msg) => V.get(id).fails.push({ sel, msg });
  V.note = (id, msg) => V.get(id).notes.push(msg);
  V.add = (id, n) => { V.get(id).count += n; };
  V.na = (id, why) => { const r = V.get(id); if (r.status !== 'n/a' && !r.count && !r.fails.length) { r.status = 'n/a'; r.notes.push(why); } };
  V.skip = (id, why) => { const r = V.get(id); r.status = 'skip'; r.notes.push(why); };
  V.put = (id, res) => { if (!res) return; if (res.na) return V.na(id, res.na); if (res.skip) return V.skip(id, res.skip); const r = V.get(id); r.count += res.count || 0; r.fails.push(...(res.fails || [])); r.notes.push(...(res.notes || [])); };
  V.crash = (id, e) => V.fail(id, 'tool', `could not be driven: ${errMsg(e)}`);
  return V;
}
function finalize(V) {
  for (const id of RULES) {
    const r = V.rules[id]; if (!r) continue;
    if (r.status === 'n/a' || r.status === 'skip') { if (r.fails.length) r.status = 'FAIL'; continue; }
    if (r.fails.length) r.status = 'FAIL';
    else if (!r.count) { r.status = 'FAIL'; r.fails.push({ sel: 'count', msg: 'measured 0 items (a comparison of nothing is not a pass)' }); }
    else r.status = 'PASS';
  }
  delete V.get; delete V.fail; delete V.note; delete V.add; delete V.na; delete V.skip; delete V.put; delete V.crash;
}

let browser;
async function newCtx(vp, { motion = 'reduce', seed = true, sink }) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, reducedMotion: motion, isMobile: vp.w < 768, hasTouch: vp.w < 768, timezoneId: 'America/New_York', locale: 'en-US' });
  ctx.setDefaultTimeout(20000); ctx.setDefaultNavigationTimeout(60000);
  if (seed) await ctx.addInitScript(() => { try { localStorage.setItem('sad-age-verified', JSON.stringify({ v: 1, at: Date.now() })); } catch (e) {} });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(BASE) || ALLOW_3P) return route.continue();
    if (sink) sink.third.add(u.slice(0, 160));
    return route.abort('blockedbyclient');
  });
  return ctx;
}
function watch(page, sink) {
  const own = (u) => !u || u.startsWith(BASE) || u.startsWith('about:') || u.startsWith('data:');
  page.on('console', (m) => {
    if (m.type() !== 'error') return; const u = (m.location() || {}).url || '';
    if (sink.ignore.some((x) => u.includes(x))) return;
    if (own(u)) sink.errs.push(`console.error: ${m.text().slice(0, 200)}${u ? ' (' + u.replace(BASE, '/') + ')' : ''}`); else sink.third.add('console: ' + m.text().slice(0, 120));
  });
  page.on('pageerror', (e) => sink.errs.push(`page error: ${errMsg(e)}`));
  page.on('requestfailed', (r) => {
    const u = r.url(); if (!u.startsWith(BASE) || sink.ignore.some((x) => u.includes(x))) return;
    const t = (r.failure() || {}).errorText || '';
    if (/ERR_ABORTED/.test(t)) { sink.aborted++; return; }   // a navigation / reload of our own cancelled it
    sink.errs.push(`request failed ${t} ${u.replace(BASE, '/')}`);
  });
  page.on('response', (r) => {
    const u = r.url(); if (!u.startsWith(BASE)) return; sink.sameOrigin++;
    if (r.status() >= 400 && !sink.ignore.some((x) => u.includes(x))) sink.errs.push(`HTTP ${r.status()} ${u.replace(BASE, '/')}`);
  });
}
const step = (s) => { STEP = s; };

// ---------------------------------------------------------------- the R5 pass
async function runR5(page, V, vp) {
  const meta = await page.evaluate(collectText);
  if (!meta.length) { V.fail('R5', 'page', 'no visible text run found to measure'); return; }
  const positions = await page.evaluate(r5Positions);
  await page.addStyleTag({ content: HIDE_CSS }); await page.waitForTimeout(80);
  const best = new Map(); const done = []; let shots = 0;
  for (const y of positions) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y); await page.waitForTimeout(90);
    const g = await page.evaluate(r5Geo, done); if (!g.length) continue;
    const png = readPng(await page.screenshot({ type: 'png' })); shots++;
    for (const { i, rects } of g) {
      const m = meta[i]; const s = sampleBg(png, rects); if (!s) continue;
      const res = { ...rate(m, s), sel: m.sel, text: m.text, min: m.min, size: m.size, weight: m.weight, decorative: m.decorative, disabled: m.disabled, overlay: m.overlay, scrollY: y };
      const prev = best.get(i); if (!prev || res.ratio / res.min < prev.ratio / prev.min) best.set(i, res);
      if (!m.overlay) done.push(i);
    }
  }
  const all = [...best.values()]; const judged = all.filter((r) => !r.decorative && !r.disabled);
  for (const r of judged) if (r.ratio < r.min - 0.005) V.fail('R5', r.sel, `contrast ${r.ratio.toFixed(2)}:1 < ${r.min}:1 (${r.size}px/${r.weight}; text ${r.fg} on ${r.bg}; ${r.how}${r.overlay ? '; sticky/fixed, worst position' : ''}; at scrollY ${r.scrollY})`);
  V.add('R5', judged.length);
  V.r5worst = all.sort((a, b) => a.ratio / a.min - b.ratio / b.min).slice(0, 10).map((r) => ({ ratio: +r.ratio.toFixed(2), min: r.min, sel: r.sel, text: r.text, fg: r.fg, bg: r.bg, how: r.how, decorative: r.decorative || undefined, disabled: r.disabled || undefined, overlay: r.overlay || undefined }));
  const deco = all.length - judged.length; const lowDeco = all.filter((r) => (r.decorative || r.disabled) && r.ratio < r.min - 0.005).length;
  V.note('R5', `${judged.length} text runs judged on pixels (${shots} screenshots at ${positions.length} positions); ${deco} decorative/disabled measured, ${lowDeco} of them below the line (not failed); ${meta.length - all.length} not reachable on screen (e.g. inside a scrolled rail)`);
}

// ---------------------------------------------------------------- R10
async function runR10(page, V) {
  await page.evaluate(() => {
    scrollTo({ top: 0, behavior: 'instant' }); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.__ckBS = new Map(); for (const el of document.querySelectorAll('*')) window.__ckBS.set(el, getComputedStyle(el).boxShadow);
    const s = document.createElement('span'); s.id = '__ck_start'; s.tabIndex = -1; document.body.prepend(s); s.focus({ preventScroll: true });
  });
  const seen = new Set(); let n = 0;
  for (let k = 0; k < 27 && n < 25; k++) {
    await page.keyboard.press('Tab'); await page.waitForTimeout(40);
    const f = await page.evaluate(() => {
      const st = document.getElementById('__ck_start'); if (st) st.remove();
      const a = document.activeElement; if (!a || a === document.body || a === document.documentElement) return { none: true };
      const { desc, color } = window.__ck; const cs = getComputedStyle(a); const oc = color(cs.outlineColor); const ow = parseFloat(cs.outlineWidth) || 0; const r = a.getBoundingClientRect();
      const bs0 = window.__ckBS.has(a) ? window.__ckBS.get(a) : 'none';
      a.__ckId = a.__ckId || Math.random().toString(36).slice(2);
      return { id: a.__ckId, sel: desc(a), skip: a.matches('a.skip-link[href="#main"]'), outline: cs.outlineStyle !== 'none' && ow > 0 && !!oc && oc.a > 0.05, o: `${cs.outlineStyle} ${ow}px ${cs.outlineColor}`,
        shadow: cs.boxShadow !== 'none' && cs.boxShadow !== bs0, inView: r.width > 1 && r.height > 1 && r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 };
    });
    if (f.none) { if (k === 0) V.fail('R10', 'document', 'Tab from the top of the page focused nothing'); break; }
    if (seen.has(f.id)) break; seen.add(f.id);
    if (k === 0) {
      if (f.skip) {
        // the skip link may slide in (transition on top / transform): give it 1.2 s to arrive before judging
        const shown = f.inView || await poll(page, () => { const a = document.activeElement; if (!a || !a.matches('a.skip-link')) return false; const r = a.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; }, 1200);
        V.note('R10', `first Tab stop is the skip link${f.inView ? '' : shown ? ' (slid into view after focus)' : ''}`);
        if (!shown) { const r = await page.evaluate(() => { const b = document.activeElement.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`; }); V.fail('R10', f.sel, `the skip link is focused but not shown inside the viewport after 1.2 s (box ${r})`); }
        continue;
      }
      V.fail('R10', f.sel, `first Tab stop is ${f.sel}, not a.skip-link[href="#main"]`);
    }
    n++;
    if (!f.outline && !f.shadow) V.fail('R10', f.sel, `no visible focus indicator (outline: ${f.o}; box-shadow unchanged)`);
  }
  V.add('R10', n); V.note('R10', `${n} focus stop(s) after the skip link checked`);
}

// ---------------------------------------------------------------- F2 drawer
async function runF2(page, V, vp) {
  const t = page.locator('button.menu-toggle').first();
  if (!(await t.count())) { V.fail('F2', 'header', 'no button.menu-toggle'); return; }
  if (!(await t.isVisible())) { V.fail('F2', 'button.menu-toggle', `menu toggle is not visible at ${vp.key} (the drawer is the menu below 1100px)`); return; }
  V.add('F2', 1);
  const pre = await page.evaluate(() => { const t = document.querySelector('button.menu-toggle'); scrollTo({ top: 0, behavior: 'instant' }); return { ctl: t.getAttribute('aria-controls'), exp: t.getAttribute('aria-expanded') }; });
  if (pre.ctl !== 'drawer') V.fail('F2', 'button.menu-toggle', `aria-controls="${pre.ctl}" (want "drawer")`);
  if (pre.exp !== 'false') V.fail('F2', 'button.menu-toggle', `aria-expanded="${pre.exp}" before opening (want "false")`);
  await t.click({ timeout: 8000 });
  const open = await poll(page, () => { const t = document.querySelector('button.menu-toggle'), d = document.getElementById('drawer'); if (!d || t.getAttribute('aria-expanded') !== 'true' || !window.__ck.vis(d)) return false; const s = d.querySelector('[data-shop-now]'); if (!s) return true; const r = s.getBoundingClientRect(); return window.__ck.vis(s) && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; }, 2500);
  const st = await page.evaluate(() => {
    const t = document.querySelector('button.menu-toggle'), d = document.getElementById('drawer'); if (!d) return { none: true };
    const s = d.querySelector('[data-status]'); const sh = d.querySelector('a[data-shop-now][href], [data-shop-now] a[href]');
    const inV = (e) => { const r = e.getBoundingClientRect(); return window.__ck.vis(e) && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; };
    return { exp: t.getAttribute('aria-expanded'), vis: window.__ck.vis(d), role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), status: s ? (s.textContent || '').trim().replace(/\s+/g, ' ') : null, statusVis: !!s && window.__ck.vis(s), shop: sh ? sh.getAttribute('href') : null, shopVis: !!sh && inV(sh), focusIn: d.contains(document.activeElement) };
  });
  if (st.none) { V.fail('F2', '#drawer', 'no #drawer element'); return; }
  if (!open) V.fail('F2', '#drawer', `toggle did not open the drawer (aria-expanded=${st.exp}, drawer visible=${st.vis}, shop link on screen=${st.shopVis})`);
  if (st.role !== 'dialog' || st.modal !== 'true') V.fail('F2', '#drawer', `role="${st.role}" aria-modal="${st.modal}" (want dialog / true)`);
  if (!st.status || !st.statusVis) V.fail('F2', '#drawer [data-status]', `drawer status ${st.status === null ? 'missing' : st.status ? 'not visible' : 'empty'}`);
  if (!st.shop) V.fail('F2', '#drawer', 'no [data-shop-now] link in the drawer'); else if (open && !st.shopVis) V.fail('F2', '#drawer [data-shop-now]', 'shop link not visible on screen');
  V.note('F2', `drawer open: status "${st.status}", shop "${st.shop}", focus moved inside: ${st.focusIn}`);
  // the page must not scroll while the drawer is open
  const sc = await page.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
  if (sc.max > 20) {
    let y2 = sc.y; let how = 'wheel';
    try { await page.mouse.move(Math.round(vp.w * 0.08), Math.round(vp.h * 0.5)); await page.mouse.wheel(0, 700); await page.waitForTimeout(400); y2 = await page.evaluate(() => scrollY); }
    catch (e) { how = 'computed overflow'; const locked = await page.evaluate(() => /hidden|clip/.test(getComputedStyle(document.body).overflowY + getComputedStyle(document.documentElement).overflowY)); if (!locked) V.fail('F2', 'body', 'body/html overflow is not hidden while the drawer is open'); }
    if (y2 !== sc.y) V.fail('F2', 'body', `the page scrolled (${sc.y} -> ${y2}px) under the open drawer (${how}): body is not locked`);
  } else V.note('F2', 'page not scrollable here; scroll lock not exercised');
  await page.keyboard.press('Escape');
  const closed = await poll(page, () => { const t = document.querySelector('button.menu-toggle'), d = document.getElementById('drawer'); return t.getAttribute('aria-expanded') === 'false' && (!d || !window.__ck.vis(d)) && document.activeElement === t; }, 2500);
  if (!closed) {
    const s = await page.evaluate(() => { const t = document.querySelector('button.menu-toggle'), d = document.getElementById('drawer'); return { exp: t.getAttribute('aria-expanded'), vis: !!d && window.__ck.vis(d), focus: window.__ck.desc(document.activeElement) }; });
    V.fail('F2', '#drawer', `Escape did not close it cleanly (aria-expanded=${s.exp}, drawer visible=${s.vis}, focus on ${s.focus})`);
    await page.evaluate(() => { const d = document.getElementById('drawer'); if (d) d.hidden = true; document.body.classList.remove('no-scroll'); });
  }
}

// ---------------------------------------------------------------- F3 reach
async function runF3(page, V) {
  const r = await page.evaluate(async () => {
    const target = Math.round(2.5 * innerHeight), max = document.documentElement.scrollHeight - innerHeight; scrollTo({ top: Math.min(target, max), behavior: 'instant' });
    await new Promise((res) => setTimeout(res, 400));
    const links = [...document.querySelectorAll('header a[href], nav.dock a[href]')].filter((a) => { try { return /\/shop\/(index\.html)?$/.test(new URL(a.href, location.href).pathname); } catch (e) { return false; } });
    const ok = links.filter((a) => { if (!window.__ck.vis(a)) return false; const b = a.getBoundingClientRect(); if (b.top < -0.5 || b.left < -0.5 || b.bottom > innerHeight + 0.5 || b.right > innerWidth + 0.5) return false; const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!h && (h === a || a.contains(h)); });
    const y = scrollY; scrollTo({ top: 0, behavior: 'instant' });
    return { y, target, max, n: links.length, ok: ok.map(window.__ck.desc), all: links.map(window.__ck.desc) };
  });
  V.add('F3', r.n);
  if (!r.n) V.fail('F3', 'header / nav.dock', 'no link to shop/ inside header or nav.dock');
  else if (!r.ok.length) V.fail('F3', 'header / nav.dock', `after scrolling to ${r.y}px no shop/ link is visible and uncovered in the viewport (candidates: ${r.all.join(' | ')})`);
  V.note('F3', `scrolled to ${r.y}px${r.y < r.target ? ` (page ends before 2.5 screens = ${r.target}px)` : ''}; reachable: ${r.ok.join(' | ') || 'none'}`);
}

// ---------------------------------------------------------------- F5 carousels
async function runF5(page, V, vp) {
  const n = await page.locator('[data-carousel]').count();
  if (!n) { V.na('F5', 'no [data-carousel] on this page'); return; }
  let ex = 0;
  for (let i = 0; i < n; i++) {
    const c = page.locator('[data-carousel]').nth(i);
    if (!(await c.isVisible())) { V.note('F5', `carousel #${i + 1} not visible at ${vp.key}`); continue; }
    await c.scrollIntoViewIfNeeded().catch(() => {});
    const st = await c.evaluate(async (el) => {
      const rail = el.querySelector('[data-rail]'); if (!rail) return { noRail: true, sel: window.__ck.desc(el) };
      rail.scrollTo({ left: 0, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 350));
      const box = (b) => { if (!b) return null; const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, vis: window.__ck.vis(b), dis: b.disabled === true || b.getAttribute('aria-disabled') === 'true' }; };
      return { sel: window.__ck.desc(el), overflow: rail.scrollWidth > rail.clientWidth + 2, sw: rail.scrollWidth, cw: rail.clientWidth, x0: rail.scrollLeft, prev: box(el.querySelector('[data-prev]')), next: box(el.querySelector('[data-next]')) };
    });
    ex++;
    if (st.noRail) { V.fail('F5', st.sel, 'no [data-rail] inside the carousel'); continue; }
    if (vp.w < 768) for (const [k, b] of [['data-prev', st.prev], ['data-next', st.next]]) if (b && b.vis && (b.w < 43.5 || b.h < 43.5)) V.fail('F5', `${st.sel} [${k}]`, `control ${b.w.toFixed(0)}x${b.h.toFixed(0)}px < 44px at phone width`);
    if (!st.overflow) { V.note('F5', `${st.sel}: rail fits (${st.sw} <= ${st.cw}px), nothing to scroll`); continue; }
    if (!st.prev) V.fail('F5', st.sel, 'no [data-prev] control'); else if (!st.prev.dis) V.fail('F5', st.sel, `[data-prev] at the start (scrollLeft ${Math.round(st.x0)}px after scrolling to 0) is neither disabled nor aria-disabled`);
    if (!st.next || !st.next.vis) { V.fail('F5', st.sel, `rail overflows (${st.sw} > ${st.cw}px) but [data-next] is ${st.next ? 'not visible' : 'missing'}`); continue; }
    try { await c.locator('[data-next]').first().click({ timeout: 6000 }); } catch (e) { V.fail('F5', st.sel, `[data-next] could not be clicked: ${errMsg(e)}`); continue; }
    let x1 = st.x0; const t0 = Date.now();
    while (Date.now() - t0 < 2500) { x1 = await c.evaluate((el) => el.querySelector('[data-rail]').scrollLeft); if (x1 > st.x0 + 1) break; await page.waitForTimeout(80); }
    if (!(x1 > st.x0 + 1)) V.fail('F5', st.sel, `[data-next] did not scroll the rail (scrollLeft ${st.x0} -> ${x1})`);
    else V.note('F5', `${st.sel}: next scrolled ${st.x0} -> ${Math.round(x1)}px`);
    await c.evaluate((el) => el.querySelector('[data-rail]').scrollTo({ left: 0, behavior: 'instant' }));
  }
  V.add('F5', ex);
  if (!ex) V.fail('F5', '[data-carousel]', `${n} carousel(s) on the page, none visible at ${vp.key}`);
}

// ---------------------------------------------------------------- F10 dialogs
async function runF10(page, V) {
  const days = await page.$$eval('[data-day]', (els) => els.map((e) => e.getAttribute('data-day')));
  if (!days.length) { V.na('F10', 'no [data-day] on this page'); return; }
  let n = 0;
  for (const d of days) {
    const ok = await page.evaluate((d) => { const g = document.getElementById('deal-' + d); return !!g && g.tagName === 'DIALOG'; }, d);
    if (!ok) { V.fail('F10', `[data-day="${d}"]`, `no dialog#deal-${d}`); continue; }
    const card = page.locator(`[data-day="${d}"]`).first();
    const self = await card.evaluate((e) => e.matches('button, a[href], [data-dialog]'));
    const opener = self ? card : card.locator('[data-dialog], button, a[href]').first();
    try { await opener.click({ timeout: 6000 }); } catch (e) { V.fail('F10', `[data-day="${d}"]`, `could not be clicked: ${errMsg(e)}`); continue; }
    const open = await poll(page, (d) => { const g = document.getElementById('deal-' + d); return g.open && g.matches(':modal'); }, 2000, d);
    if (!open) { V.fail('F10', `[data-day="${d}"]`, `click did not open dialog#deal-${d} as a modal`); await page.evaluate((d) => { const g = document.getElementById('deal-' + d); if (g.open) g.close(); }, d); continue; }
    n++;
    await page.keyboard.press('Escape');
    const closed = await poll(page, (d) => !document.getElementById('deal-' + d).open, 2000, d);
    if (!closed) { V.fail('F10', `dialog#deal-${d}`, 'still open after Escape'); await page.evaluate((d) => document.getElementById('deal-' + d).close(), d); }
  }
  V.add('F10', n); V.note('F10', `${n}/${days.length} day cards opened their modal and closed on Escape`);
}

// ---------------------------------------------------------------- F1 age gate
async function runF1(vp, url, V, sink, motion) {
  const ctx = await newCtx(vp, { motion, seed: false, sink });
  try {
    const page = await ctx.newPage(); watch(page, sink);
    await page.goto(url, { waitUntil: 'load' }); await settle(page);
    const tag = `[${motion === 'reduce' ? 'reduced motion' : 'motion on'}]`;
    const g = await poll(page, () => { const g = document.getElementById('age-gate'); if (!g) return { none: true }; const r = g.getBoundingClientRect(); const v = window.__ck.vis(g) && r.width > 100 && r.height > 100; return v ? { ok: true, role: g.getAttribute('role'), modal: g.getAttribute('aria-modal'), yes: !!g.querySelector('[data-age-yes]'), no: !!g.querySelector('[data-age-no]') } : false; }, 2500);
    if (!g || g.none) { V.fail('F1', '#age-gate', `${tag} ${g && g.none ? 'no #age-gate element' : 'gate not visible on a first visit'}`); return; }
    V.add('F1', 1);
    if (g.role !== 'dialog' || g.modal !== 'true') V.fail('F1', '#age-gate', `${tag} role="${g.role}" aria-modal="${g.modal}"`);
    if (!g.yes || !g.no) { V.fail('F1', '#age-gate', `${tag} missing [data-age-yes] / [data-age-no]`); return; }
    const focusIn = await poll(page, () => document.getElementById('age-gate').contains(document.activeElement), 2500);
    if (!focusIn) V.fail('F1', '#age-gate', `${tag} focus is not inside the gate (on ${await page.evaluate(() => window.__ck.desc(document.activeElement))})`);
    const nF = await page.evaluate(() => [...document.getElementById('age-gate').querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((e) => window.__ck.vis(e)).length);
    let escaped = null;
    for (let k = 0; k < nF + 2 && !escaped; k++) { await page.keyboard.press('Tab'); escaped = await page.evaluate(() => (document.getElementById('age-gate').contains(document.activeElement) ? null : window.__ck.desc(document.activeElement))); }
    for (let k = 0; k < 2 && !escaped; k++) { await page.keyboard.press('Shift+Tab'); escaped = await page.evaluate(() => (document.getElementById('age-gate').contains(document.activeElement) ? null : window.__ck.desc(document.activeElement))); }
    if (escaped) V.fail('F1', '#age-gate', `${tag} Tab left the gate (focus reached ${escaped}): no focus trap`);
    await page.locator('#age-gate [data-age-yes]').click({ timeout: 6000 });
    const gone = await poll(page, () => !window.__ck.vis(document.getElementById('age-gate')), 2500);
    if (!gone) V.fail('F1', '[data-age-yes]', `${tag} Yes did not close the gate`);
    const stored = await page.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('sad-age-verified') || 'null'); return { raw: localStorage.getItem('sad-age-verified'), ok: !!v && v.v === 1 && typeof v.at === 'number' && Math.abs(Date.now() - v.at) < 120000 }; } catch (e) { return { raw: String(e), ok: false }; } });
    if (!stored.ok) V.fail('F1', '[data-age-yes]', `${tag} localStorage sad-age-verified = ${stored.raw} (want {"v":1,"at":<now>})`);
    await page.reload({ waitUntil: 'load' }); await settle(page); await page.waitForTimeout(250);
    const back = await page.evaluate(() => window.__ck.vis(document.getElementById('age-gate')));
    if (back) V.fail('F1', '#age-gate', `${tag} the gate shows again after a reload (the answer was not remembered)`);
    V.note('F1', `${tag} shown, focus in ${!!focusIn}, ${nF} focusable(s) trapped ${!escaped}, Yes closes ${!!gone}, stored ${stored.ok}, reload stays closed ${!back}`);
    if (motion !== 'reduce') return;
    // No -> https://google.com (intercepted, never loaded)
    const ctx2 = await newCtx(vp, { motion, seed: false, sink });
    try {
      const p2 = await ctx2.newPage(); watch(p2, sink); let nav = null;
      await p2.route(/^https?:\/\/(www\.)?google\.com(\/.*)?$/, (route) => { nav = route.request().url(); return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>intercepted</title>' }); });
      await p2.goto(url, { waitUntil: 'load' }); await settle(p2);
      await p2.locator('#age-gate [data-age-no]').click({ timeout: 6000 });
      const t0 = Date.now(); while (!nav && Date.now() - t0 < 4000) await p2.waitForTimeout(80);
      if (!nav) V.fail('F1', '[data-age-no]', 'No did not navigate to https://google.com within 4 s');
      else if (!/^https:\/\/(www\.)?google\.com\/?$/.test(nav)) V.fail('F1', '[data-age-no]', `No navigated to ${nav} (want https://google.com)`);
      else V.note('F1', `No -> ${nav} (intercepted)`);
      V.add('F1', 1);
    } finally { await ctx2.close().catch(() => {}); }
  } finally { await ctx.close().catch(() => {}); }
}

// ---------------------------------------------------------------- F4 + F9 (motion on)
async function runMotion(vp, url, V, sink) {
  const ctx = await newCtx(vp, { motion: 'no-preference', seed: true, sink });
  try {
    const page = await ctx.newPage(); watch(page, sink);
    await page.goto(url, { waitUntil: 'load' }); await settle(page); await page.waitForTimeout(400);
    if (want('F9')) {
      const n = await page.evaluate(() => document.querySelectorAll('[data-reveal]').length);
      if (!n) V.na('F9', 'no [data-reveal] on this page');
      else {
        const r = await page.evaluate(async () => {
          const els = [...document.querySelectorAll('[data-reveal]')]; const bad = []; let ok = 0;
          for (const el of els) {
            if (!el.getClientRects().length) continue;
            el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
            const t0 = performance.now(); let op = 0;
            while (performance.now() - t0 < 4000) { op = parseFloat(getComputedStyle(el).opacity); if (op >= 0.99) break; await new Promise((res) => setTimeout(res, 50)); }
            if (op >= 0.99) ok++; else bad.push(`${window.__ck.desc(el)} opacity ${op.toFixed(2)} after 4 s in view`);
          }
          scrollTo({ top: 0, behavior: 'instant' });
          return { ok, bad, n: els.length };
        });
        V.add('F9', r.ok + r.bad.length);
        for (const b of r.bad.slice(0, 12)) V.fail('F9', '[data-reveal]', `[motion on] ${b}`);
        if (r.bad.length > 12) V.fail('F9', '[data-reveal]', `... ${r.bad.length - 12} more stuck`);
        V.note('F9', `[motion on] ${r.ok}/${r.n} reveals reached opacity 1 in view`);
      }
    }
    if (want('F4')) {
      const a0 = await page.evaluate(() => { const a = document.getAnimations(); return { total: a.length, running: a.filter((x) => x.playState === 'running').length }; });
      V.add('F4', a0.total);
      if (!a0.running) V.fail('F4', 'document', `[motion on] no running animation (${a0.total} animation objects)`);
      const btn = page.locator('button[data-motion-toggle]:visible').first();
      if (!(await btn.count())) { V.fail('F4', 'button[data-motion-toggle]', 'no visible motion toggle'); return; }
      await btn.click({ timeout: 8000 });
      const chk = () => { const a = document.getAnimations(); const live = a.filter((x) => !['paused', 'finished', 'idle'].includes(x.playState)); const tg = [...document.querySelectorAll('button[data-motion-toggle]')]; const vids = [...document.querySelectorAll('video')].filter((v) => !v.paused && !v.ended);
        let ls = null; try { ls = localStorage.getItem('sad-motion'); } catch (e) {}
        return { attr: document.documentElement.getAttribute('data-motion'), pressed: tg.map((b) => b.getAttribute('aria-pressed')), live: live.length, liveNames: live.slice(0, 4).map((x) => (x.animationName || x.transitionProperty || 'animation') + ' on ' + (x.effect && x.effect.target ? window.__ck.desc(x.effect.target) : '?')), vids: vids.length, ls, total: a.length }; };
      const okFn = () => { const a = document.getAnimations(); return document.documentElement.getAttribute('data-motion') === 'paused' && a.every((x) => ['paused', 'finished', 'idle'].includes(x.playState)); };
      await poll(page, okFn, 3000);
      const s1 = await page.evaluate(chk);
      if (s1.attr !== 'paused') V.fail('F4', 'html', `after the pause click html[data-motion] = "${s1.attr}" (want "paused")`);
      if (!s1.pressed.length || s1.pressed.some((p) => p !== 'true')) V.fail('F4', 'button[data-motion-toggle]', `aria-pressed after pausing: ${s1.pressed.join(',')}`);
      if (s1.live) V.fail('F4', 'document', `${s1.live} of ${s1.total} animations still running after pausing: ${s1.liveNames.join('; ')}`);
      if (s1.vids) V.fail('F4', 'video', `${s1.vids} video(s) still playing`);
      if (s1.ls !== 'paused') V.fail('F4', 'localStorage', `sad-motion = ${JSON.stringify(s1.ls)} (want "paused")`);
      await page.reload({ waitUntil: 'load' }); await settle(page);
      await poll(page, okFn, 2500);
      const s2 = await page.evaluate(chk);
      if (s2.attr !== 'paused' || s2.pressed.some((p) => p !== 'true') || s2.live) V.fail('F4', 'reload', `pause does not persist after reload (data-motion="${s2.attr}", aria-pressed ${s2.pressed.join(',')}, ${s2.live} running${s2.liveNames.length ? ': ' + s2.liveNames.join('; ') : ''})`);
      V.note('F4', `[motion on] ${a0.running}/${a0.total} animations running before pause; after: ${s1.live} live; after reload: ${s2.live} live`);
    }
  } finally { await ctx.close().catch(() => {}); }
}

// ---------------------------------------------------------------- F6 + F7 (fixed clock, New York)
const TIMES = [
  { t: '2026-11-04T19:52:00-05:00', label: 'Wed 19:52', f7: ['Open Now', 'Closes in 8 min'], open: true },
  { t: '2026-11-04T12:00:00-05:00', label: 'Wed 12:00', f7: ['Open Now', 'Open until 8PM'], open: true, f6: '3' },
  { t: '2026-11-04T07:30:00-05:00', label: 'Wed 07:30', f7: ['Closed', 'Opens today at 9AM'], open: false },
  { t: '2026-11-07T21:00:00-05:00', label: 'Sat 21:00', f7: ['Closed', 'Opens tomorrow at 10AM'], open: false },
  { t: '2026-11-08T09:30:00-05:00', label: 'Sun 09:30', f7: ['Closed', 'Opens today at 10AM'], open: false },
  { t: '2026-11-08T23:30:00-05:00', label: 'Sun 23:30', f6: '0' },
];
async function runClock(vp, url, V, sink) {
  const ctx = await newCtx(vp, { motion: 'reduce', seed: true, sink });
  try {
    const page = await ctx.newPage(); watch(page, sink); let noDays = false;
    for (const x of TIMES.filter((x) => (want('F7') && x.f7) || (want('F6') && x.f6 !== undefined))) {
      await page.clock.setFixedTime(new Date(x.t));
      await page.goto(url, { waitUntil: 'load' }); await settle(page); await page.waitForTimeout(120);
      const s = await page.evaluate(() => { const st = document.querySelector('header.site-header [data-status]'); const days = [...document.querySelectorAll('[data-day]')];
        return { status: st ? (st.textContent || '').replace(/\s+/g, ' ').trim() : null, nDays: days.length, today: days.filter((d) => d.hasAttribute('data-today')).map((d) => d.getAttribute('data-day')),
          ny: new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()) }; });
      const clockOk = s.ny.replace(/\s+/g, ' ').includes(x.label.split(' ')[0]) && s.ny.includes(x.label.split(' ')[1]);
      for (const id of ['F7', 'F6']) {
        if (!want(id) || (id === 'F7' && !x.f7) || (id === 'F6' && x.f6 === undefined)) continue;
        if (!clockOk) { V.fail(id, 'clock', `fixed clock not applied: the page sees "${s.ny}", wanted ${x.label}`); continue; }
        if (id === 'F7') {
          if (s.status === null) { V.fail('F7', 'header.site-header', 'no [data-status] in the header'); continue; }
          V.add('F7', 1);
          const miss = x.f7.filter((w) => !s.status.includes(w)); const wrong = x.open ? s.status.includes('Closed') : s.status.includes('Open Now');
          if (miss.length || wrong) V.fail('F7', 'header [data-status]', `${x.label}: "${s.status}" (want "${x.f7.join('" + "')}")`);
          else V.note('F7', `${x.label}: "${s.status}"`);
        } else {
          if (!s.nDays) { noDays = true; continue; }
          V.add('F6', 1);
          if (s.today.length !== 1 || s.today[0] !== x.f6) V.fail('F6', '[data-day][data-today]', `${x.label}: data-today on [${s.today.join(',')}] of ${s.nDays} cards (want exactly "${x.f6}")`);
          else V.note('F6', `${x.label}: today = ${s.today[0]}`);
        }
      }
    }
    if (noDays && want('F6')) V.na('F6', 'no [data-day] on this page');
  } finally { await ctx.close().catch(() => {}); }
}

// ---------------------------------------------------------------- F8 forms
const FORM_KEYS = {
  '/api/contact': { req: ['site', 'name', 'email', 'message'], opt: ['phone'] },
  '/api/careers/apply': { req: ['site', 'role', 'name', 'email'], opt: ['phone', 'availability', 'experience', 'resumeUrl', 'message'] },
  '/api/newsletter/subscribe': { req: ['email', 'site', 'source'], opt: [] },
};
async function runForms(vp, url, V, sink) {
  const ctx = await newCtx(vp, { motion: 'reduce', seed: true, sink });
  try {
    const page = await ctx.newPage(); watch(page, sink);
    await page.goto(url, { waitUntil: 'load' }); await settle(page);
    const forms = await page.$$eval('form[data-api]', (fs) => fs.map((f) => f.getAttribute('data-api')));
    if (!forms.length) { V.na('F8', 'no form[data-api] on this page'); return; }
    for (const api of forms) sink.ignore.push(api);
    for (let i = 0; i < forms.length; i++) {
      const api = forms[i]; const tag = `form[data-api="${api}"]`; const spec = FORM_KEYS[api];
      if (!spec) { V.fail('F8', tag, `unknown endpoint (live endpoints: ${Object.keys(FORM_KEYS).join(', ')})`); continue; }
      const form = page.locator('form[data-api]').nth(i); let mode = 'ok'; let cap = null;
      const matcher = (u) => { try { return new URL(u).pathname === api; } catch (e) { return false; } };
      const handler = (route) => { const rq = route.request(); cap = { method: rq.method(), ct: rq.headers()['content-type'] || '', body: rq.postData() };
        return route.fulfill(mode === 'ok' ? { status: 200, contentType: 'application/json', body: '{"ok":true}' } : { status: 500, contentType: 'application/json', body: '{"error":"x"}' }); };
      await page.route(matcher, handler);
      const fill = async () => {
        const fields = form.locator('[required]'); const k = await fields.count();
        for (let j = 0; j < k; j++) {
          const f = fields.nth(j); const d = await f.evaluate((e) => ({ tag: e.tagName, type: (e.getAttribute('type') || '').toLowerCase(), name: e.name }));
          if (d.tag === 'SELECT') { const v = await f.evaluate((e) => ([...e.options].find((o) => o.value && !o.disabled) || {}).value); if (v) await f.selectOption(v); }
          else if (d.type === 'checkbox' || d.type === 'radio') await f.check({ force: true });
          else if (d.type === 'hidden') continue;
          else await f.fill(d.type === 'email' ? 'check@example.com' : d.type === 'tel' ? '5550100100' : d.type === 'url' ? 'https://example.com/resume.pdf' : d.type === 'number' ? '1' : d.type === 'date' ? '2026-11-05' : d.tag === 'TEXTAREA' ? 'A message from the rendered gate.' : 'Check Runner');
        }
        return k;
      };
      const status = () => form.evaluate((f) => { const s = f.querySelector('[data-form-status]') || document.querySelector('[data-form-status]'); return s ? { text: (s.textContent || '').trim(), live: s.getAttribute('aria-live'), inForm: f.contains(s) } : null; });
      const submit = async () => { const b = form.locator('button[type="submit"], input[type="submit"], button:not([type])').first(); if (!(await b.count())) return false; await b.click({ timeout: 6000 }); return true; };
      const sending = await form.evaluate((f) => f.getAttribute('data-msg-sending') || '');
      const nReq = await fill();
      if (!(await submit())) { V.fail('F8', tag, 'no submit button'); await page.unroute(matcher, handler); continue; }
      let t0 = Date.now(), st = null;
      while (Date.now() - t0 < 6000) { st = await status(); if (cap && st && st.text && st.text !== sending) break; await page.waitForTimeout(80); }
      V.add('F8', 1);
      if (!cap) { const inv = await form.evaluate((f) => [...f.elements].filter((e) => e.willValidate && !e.checkValidity()).map((e) => `${e.name || e.id}: ${e.validationMessage}`).join('; ')); V.fail('F8', tag, `no request reached ${api} after submit (${nReq} required field(s) filled${inv ? '; invalid: ' + inv : ''})`); await page.unroute(matcher, handler); continue; }
      let body = null; try { body = JSON.parse(cap.body || ''); } catch (e) {}
      if (cap.method !== 'POST') V.fail('F8', tag, `method ${cap.method} (want POST)`);
      if (!/application\/json/i.test(cap.ct)) V.fail('F8', tag, `Content-Type "${cap.ct}" (want application/json)`);
      if (!body || typeof body !== 'object' || Array.isArray(body)) V.fail('F8', tag, `request body is not a JSON object: ${String(cap.body).slice(0, 120)}`);
      else {
        const keys = Object.keys(body); const miss = spec.req.filter((k) => !(k in body)); const extra = keys.filter((k) => !spec.req.includes(k) && !spec.opt.includes(k));
        if (miss.length || extra.length) V.fail('F8', tag, `payload keys [${keys.join(',')}]: missing [${miss.join(',')}], not live [${extra.join(',')}] (live: ${spec.req.join(',')}${spec.opt.length ? ' + optional ' + spec.opt.join(',') : ''})`);
        if (body.site !== 'sfd') V.fail('F8', tag, `site = ${JSON.stringify(body.site)} (want "sfd", the Springfield tenant)`);
        if (spec.req.includes('source') && !body.source) V.fail('F8', tag, 'source is empty');
        V.note('F8', `${api} body ${JSON.stringify(body).slice(0, 160)}`);
      }
      if (!st) V.fail('F8', tag, 'no [data-form-status] element');
      else {
        if (st.live !== 'polite') V.fail('F8', tag, `[data-form-status] aria-live="${st.live}" (want polite)`);
        if (!st.text || st.text === sending) V.fail('F8', tag, `200 response: [data-form-status] shows "${st.text}" (want a message)`);
      }
      const okText = st && st.text;
      // error path
      mode = 'err'; cap = null; await fill();
      await submit(); t0 = Date.now(); let st2 = null;
      while (Date.now() - t0 < 6000) { st2 = await status(); if (cap && st2 && st2.text && st2.text !== sending && st2.text !== okText) break; await page.waitForTimeout(80); }
      if (!cap) V.fail('F8', tag, 'second submit (500 mock) sent no request');
      else if (!st2 || !st2.text || st2.text === okText || st2.text === sending) V.fail('F8', tag, `500 response: [data-form-status] shows "${st2 && st2.text}" (want an error message, not the success text)`);
      else V.note('F8', `${api}: ok "${okText}" / error "${st2.text}"`);
      await page.unroute(matcher, handler);
    }
  } finally { await ctx.close().catch(() => {}); }
}

// ---------------------------------------------------------------- one page x viewport
async function runOne(pg, vp) {
  const V = newRun(pg, vp); report.runs.push(V);
  const url = BASE + pg.path; const func = FUNC_VPS.has(vp.key); const isHome = pg.path === '';
  const sink = { errs: [], third: new Set(), sameOrigin: 0, aborted: 0, ignore: [] };
  const tag = `${pg.key} @${vp.key}`;
  const layoutIds = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R10'];
  const needLayout = layoutIds.some(want) || want('R9') || (want('F2') && vp.w < 1100) || (want('F3') && vp.key === '390x844') || (func && ['F4', 'F5', 'F9', 'F10'].some(want));
  for (const id of ['F1', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10']) if (want(id) && !func) V.skip(id, 'functional checks run at 1440x900 and 390x844');
  if (want('F2') && vp.w >= 1100) V.skip('F2', 'the drawer is the menu below 1100px');
  if (want('F3') && vp.key !== '390x844') V.skip('F3', 'runs at 390x844');
  if (needLayout) {
    const ctx = await newCtx(vp, { motion: 'reduce', seed: true, sink });
    try {
      const page = await ctx.newPage(); watch(page, sink);
      step(`${tag} load`); await page.goto(url, { waitUntil: 'load' }); await settle(page);
      if (func && want('F9')) {
        const r = await page.evaluate(() => { const els = [...document.querySelectorAll('[data-reveal]')]; return { n: els.length, low: els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99).map((e) => `${window.__ck.desc(e)} opacity ${getComputedStyle(e).opacity}`) }; });
        if (!r.n) V.na('F9', 'no [data-reveal] on this page');
        else { V.add('F9', r.n); for (const l of r.low.slice(0, 10)) V.fail('F9', '[data-reveal]', `[reduced motion] ${l} at load`); V.note('F9', `[reduced motion] ${r.n - r.low.length}/${r.n} reveals at opacity 1 at load`); }
      }
      if (func && want('F4')) {
        const inf = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map((a) => `${a.animationName || 'animation'} on ${a.effect.target ? window.__ck.desc(a.effect.target) : '?'}`));
        for (const a of inf.slice(0, 8)) V.fail('F4', 'reduced motion', `infinite animation running under prefers-reduced-motion: ${a}`);
        V.note('F4', `[reduced motion] ${inf.length} infinite animation(s) running`);
      }
      if (want('R2')) { step(`${tag} R2`); try { await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); V.put('R2', await page.evaluate(measureHero, isHome)); } catch (e) { V.crash('R2', e); } }
      const lw = { R1: want('R1'), R3: want('R3'), R4: want('R4'), R7: want('R7'), R8: want('R8') };
      if (Object.values(lw).some(Boolean)) { step(`${tag} R1/R3/R4/R7/R8`); try { const m = await page.evaluate(measureLayout, lw); for (const id of Object.keys(m)) V.put(id, m[id]); } catch (e) { for (const id of Object.keys(lw)) if (lw[id]) V.crash(id, e); } }
      step(`${tag} R6 / lazy images`);
      if (want('R6')) { try { V.put('R6', await page.evaluate(measureImages)); } catch (e) { V.crash('R6', e); } }
      else await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 30)); } scrollTo({ top: 0, behavior: 'instant' }); });
      if (SHOTS) { const f = path.join(SHOTS_DIR, pg.key, vp.key + '.png'); fs.mkdirSync(path.dirname(f), { recursive: true }); await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(150); await page.screenshot({ path: f }); V.notes.push('shot ' + path.relative(ROOT, f)); }
      if (want('R10')) { step(`${tag} R10`); try { await runR10(page, V); } catch (e) { V.crash('R10', e); } }
      let touched = false;
      if (want('F2') && vp.w < 1100) { step(`${tag} F2`); touched = true; try { await runF2(page, V, vp); } catch (e) { V.crash('F2', e); } }
      if (want('F3') && vp.key === '390x844') { step(`${tag} F3`); touched = true; try { await runF3(page, V); } catch (e) { V.crash('F3', e); } }
      if (func && want('F5')) { step(`${tag} F5`); touched = true; try { await runF5(page, V, vp); } catch (e) { V.crash('F5', e); } }
      if (func && want('F10')) { step(`${tag} F10`); touched = true; try { await runF10(page, V); } catch (e) { V.crash('F10', e); } }
      if (want('R5')) {
        step(`${tag} R5 contrast`);
        try {
          if (touched) { await page.reload({ waitUntil: 'load' }); await settle(page); await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 30)); } scrollTo({ top: 0, behavior: 'instant' }); }); await page.waitForTimeout(150); }
          await runR5(page, V, vp);
        } catch (e) { V.crash('R5', e); }
      }
    } finally { await ctx.close().catch(() => {}); }
  }
  if (func && want('F1')) { step(`${tag} F1`); try { await runF1(vp, url, V, sink, 'reduce'); await runF1(vp, url, V, sink, 'no-preference'); } catch (e) { V.crash('F1', e); } }
  if (func && (want('F4') || want('F9'))) { step(`${tag} F4/F9 motion on`); try { await runMotion(vp, url, V, sink); } catch (e) { if (want('F4')) V.crash('F4', e); if (want('F9')) V.crash('F9', e); } }
  if (func && (want('F6') || want('F7'))) { step(`${tag} F6/F7 clock`); try { await runClock(vp, url, V, sink); } catch (e) { if (want('F6')) V.crash('F6', e); if (want('F7')) V.crash('F7', e); } }
  if (func && want('F8')) { step(`${tag} F8 forms`); try { await runForms(vp, url, V, sink); } catch (e) { V.crash('F8', e); } }
  if (want('R9')) {
    V.add('R9', sink.sameOrigin);
    for (const e of [...new Set(sink.errs)].slice(0, 30)) V.fail('R9', 'console/network', e);
    V.note('R9', `${sink.sameOrigin} same-origin responses, ${sink.third.size} third-party request(s) blocked/recorded, ${sink.aborted} same-origin request(s) cancelled by our own reloads`);
  }
  V.thirdParty = [...sink.third].slice(0, 40);
  finalize(V);
  return V;
}

// ---------------------------------------------------------------- main
let exitCode = 1;
try {
  browser = await chromium.launch({ headless: true });
  for (const p of PATHS) for (const vp of VPS) {
    const pg = { path: p, key: pageKey(p) }; step(`${pg.key} @${vp.key}`);
    const t0 = Date.now(); const V = await runOne(pg, vp); V.seconds = Math.round((Date.now() - t0) / 1000);
    const bad = RULES.filter((id) => V.rules[id] && V.rules[id].status === 'FAIL');
    console.log(`${pg.key} @${vp.key}: ${bad.length ? 'FAIL ' + bad.join(',') : 'PASS'} (${V.seconds}s)`);
    writeReport();
  }
  // ---- table
  const ran = RULES.filter((id) => want(id));
  const col = (s, w) => String(s).padEnd(w).slice(0, w);
  const lab = Math.min(44, Math.max(16, ...report.runs.map((r) => `${r.page} @${r.vp}`.length)) + 2);
  console.log('\n' + col('page @ viewport', lab) + ran.map((id) => col(id, 6)).join(''));
  for (const r of report.runs) console.log(col(`${r.page} @${r.vp}`, lab) + ran.map((id) => { const x = r.rules[id]; return col(!x ? '.' : x.status === 'PASS' ? x.count : x.status === 'FAIL' ? 'FAIL' : x.status === 'n/a' ? '-' : '.', 6); }).join(''));
  console.log('(number = PASS with that many items measured; FAIL; - = n/a, hook absent; . = not in scope at this viewport)');
  // ---- details
  let fails = 0;
  for (const r of report.runs) {
    const bad = ran.filter((id) => r.rules[id] && r.rules[id].status === 'FAIL'); if (!bad.length) continue;
    console.log(`\n${r.page} @${r.vp}`);
    for (const id of bad) { const x = r.rules[id]; fails++; console.log(`  ${id} FAIL (${x.fails.length}; measured ${x.count})`); for (const f of x.fails.slice(0, 8)) console.log(`     ${f.sel}: ${f.msg}`); if (x.fails.length > 8) console.log(`     ... ${x.fails.length - 8} more in the JSON`); }
    if (r.r5worst && bad.includes('R5')) { console.log('  R5 worst 10:'); for (const w of r.r5worst) console.log(`     ${w.ratio.toFixed(2)}:1 (min ${w.min}) ${w.sel} ${w.fg} on ${w.bg}${w.decorative ? ' [decorative]' : ''}${w.disabled ? ' [disabled]' : ''}`); }
  }
  // ---- a requested check that never ran is a FAIL
  const neverRan = []; const allNa = [];
  for (const id of ran) {
    const xs = report.runs.map((r) => r.rules[id]).filter(Boolean);
    if (!xs.some((x) => x.status === 'PASS' || x.status === 'FAIL' || x.status === 'n/a')) neverRan.push(id);
    else if (!xs.some((x) => x.status === 'PASS' || x.status === 'FAIL')) allNa.push(id);
  }
  if (allNa.length) console.log(`\nn/a on every page (hook absent): ${allNa.join(', ')}`);
  if (neverRan.length) console.log(`\nNOT RUN at any viewport in --vp (counts as FAIL): ${neverRan.join(', ')}`);
  const measured = report.runs.reduce((t, r) => t + Object.values(r.rules).filter((x) => x.status === 'PASS').length, 0);
  const third = [...new Set(report.runs.flatMap((r) => r.thirdParty))];
  if (third.length) console.log(`\nthird-party requests ${ALLOW_3P ? 'allowed' : 'blocked'} (${third.length}): ${third.slice(0, 6).join(' | ')}${third.length > 6 ? ' ...' : ''}`);
  const ok = !fails && !neverRan.length && measured > 0;
  report.summary = { pass: ok, failingChecks: fails, neverRan, naEverywhere: allNa, passingChecks: measured, runs: report.runs.length };
  writeReport();
  console.log(`\nreport: ${path.relative(ROOT, OUT)}`);
  console.log(ok ? `check: PASS (${report.runs.length} page x viewport runs, ${measured} checks passed, each measured > 0 items)` : `check: FAIL (${fails} failing check(s)${neverRan.length ? ', not run: ' + neverRan.join(',') : ''}${measured ? '' : ', nothing measured'})`);
  exitCode = ok ? 0 : 1;
} catch (e) {
  console.error('check: crashed during "' + STEP + '": ' + (e && e.stack || e)); report.aborted = 'crash: ' + errMsg(e); writeReport(); exitCode = 1;
} finally {
  if (browser) await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
  server.close();
}
process.exit(exitCode);
