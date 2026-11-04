#!/usr/bin/env node
// build.mjs — assemble the redesigned site into dist/ from src/.
//
//   node src/tools/build.mjs [--out dist] [--only home,about] [--preview] [--base /]
//
// For every page in src/content/site.json whose template renderer exists (src/pages/<template>.mjs) it writes
// <out>/<path>index.html (404.html at the root). Links are RELATIVE (dist/ works from any folder), except the 404 page,
// which a host serves at any missing path and therefore links from --base (default "/").
// CSS: tokens+base+atmosphere+components+chrome -> assets/css/site.css; src/styles/pages/<template>.css -> assets/css/<template>.css.
// JS:  src/scripts/site.js -> assets/js/site.js; src/scripts/<name>.js -> assets/js/<name>.js when a renderer asks for it.
// Images: only files some page or stylesheet references are copied. --preview adds noindex (public preview hosts).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeLink } from '../lib/h.mjs';
import { page as renderDoc } from '../lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(ROOT, arg('--out', 'dist'));
const ONLY = arg('--only', '') ? arg('--only', '').split(',') : null;
const PREVIEW = process.argv.includes('--preview');
const BASE = arg('--base', '/');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SITE = J('src/content/site.json');
const S = J('src/content/shared.json');
const UI = J('src/content/ui-labels.json');
const META_NEW = (UI.pageMeta || {});

// ---- clean output (keep nothing stale)
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---- CSS
const CORE = ['tokens', 'base', 'atmosphere', 'components', 'chrome'];
const readCss = (f) => fs.readFileSync(path.join(ROOT, 'src', 'styles', f), 'utf8');
fs.mkdirSync(path.join(OUT, 'assets', 'css'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'assets', 'css', 'site.css'), CORE.map((n) => `/* ${n}.css */\n` + readCss(n + '.css')).join('\n'));
// page CSS = src/styles/pages/<tpl>.css and/or every file in src/styles/pages/<tpl>/ (sorted) — one file per section/lane
const pageCss = (tpl) => {
  const parts = []; const f = path.join(ROOT, 'src', 'styles', 'pages', tpl + '.css'); const dir = path.join(ROOT, 'src', 'styles', 'pages', tpl);
  if (fs.existsSync(f)) parts.push(f);
  if (fs.existsSync(dir)) for (const g of fs.readdirSync(dir).filter((x) => x.endsWith('.css')).sort()) parts.push(path.join(dir, g));
  return parts.length ? parts.map((x) => `/* ${path.relative(path.join(ROOT, 'src', 'styles'), x)} */\n` + fs.readFileSync(x, 'utf8')).join('\n') : null;
};

// ---- JS
fs.mkdirSync(path.join(OUT, 'assets', 'js'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src', 'scripts', 'site.js'), path.join(OUT, 'assets', 'js', 'site.js'));
const copiedJs = new Set();

// ---- fonts
fs.mkdirSync(path.join(OUT, 'assets', 'fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'src', 'assets-static', 'fonts'))) fs.copyFileSync(path.join(ROOT, 'src', 'assets-static', 'fonts', f), path.join(OUT, 'assets', 'fonts', f));

// ---- renderers
const tplCache = {};
async function renderer(tpl) {
  if (tpl in tplCache) return tplCache[tpl];
  const f = path.join(ROOT, 'src', 'pages', tpl + '.mjs');
  tplCache[tpl] = fs.existsSync(f) ? await import(pathToFileURL(f).href) : null;
  return tplCache[tpl];
}
const contentFor = (pg) => {
  const f = path.join(ROOT, 'src', 'content', 'pages', pg.id + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const t = path.join(ROOT, 'src', 'content', 'pages', pg.template + '.json');      // a template-shared model
  return fs.existsSync(t) ? JSON.parse(fs.readFileSync(t, 'utf8')) : null;
};

const built = [], skipped = [];
for (const pg0 of SITE.pages) {
  if (ONLY && !ONLY.includes(pg0.id) && !ONLY.includes(pg0.template)) continue;
  const mod = await renderer(pg0.template);
  if (!mod) { skipped.push(pg0.id + ' (no src/pages/' + pg0.template + '.mjs)'); continue; }
  const pg = structuredClone(pg0);
  if (pg.isNew) pg.head = { ...(META_NEW[pg.id] || {}), og: (META_NEW[pg.id] || {}).og || {}, ld: [] };
  if (PREVIEW) pg.head.robots = 'noindex, nofollow';
  const is404 = pg.path === '404.html';
  const link = is404 ? ((to) => (to == null ? '#' : /^(https?:|mailto:|tel:|#)/.test(to) ? to : BASE.replace(/\/?$/, '/') + to.replace(/^\//, ''))) : makeLink(pg.path);
  const ctx = { page: pg, S, link, content: contentFor(pg), site: SITE, root: ROOT };
  const r = await mod.render(ctx);
  const css = ['assets/css/site.css'];
  // a renderer may pull other templates' page CSS first (r.cssFrom, e.g. category pages reuse the shop sheet)
  for (const t of [...new Set([...(r.cssFrom || []), pg.template])]) {
    const pc = pageCss(t);
    if (pc) { fs.writeFileSync(path.join(OUT, 'assets', 'css', t + '.css'), pc); css.push('assets/css/' + t + '.css'); }
  }
  for (const s of r.scripts || []) {
    const name = path.basename(s);
    if (!copiedJs.has(name)) { fs.copyFileSync(path.join(ROOT, 'src', 'scripts', name), path.join(OUT, 'assets', 'js', name)); copiedJs.add(name); }
  }
  let htmlOut = renderDoc({ page: pg, S, link, css, main: r.main, extraHead: r.head || '', scripts: r.scripts || [], bodyClass: r.bodyClass || '' });
  // progressive enhancement: a form that posts through JS (data-api) also names the same endpoint as its action, so it
  // still submits without JS (to the live endpoint, form-encoded; with JS site.js sends the live JSON payload instead)
  htmlOut = htmlOut.replace(/<form\b(?![^>]*\baction=)([^>]*?)\bdata-api="([^"]+)"/g, (m, pre, api) => `<form action="${api}" method="post"${pre}data-api="${api}"`);
  // ...and the fixed payload fields (data-extra: site, source) travel as hidden inputs so a no-JS post carries them too
  htmlOut = htmlOut.replace(/(<form\b[^>]*\bdata-extra="([^"]*)"[^>]*>)/g, (m, tag, extra) => {
    let x = {}; try { x = JSON.parse(extra.replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch { return m; }
    return tag + Object.entries(x).map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`).join('');
  });
  const file = is404 ? path.join(OUT, '404.html') : path.join(OUT, pg.path, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, htmlOut);
  built.push(pg.id);
}

// ---- images: copy only what is referenced
const IMG_SRC = path.join(ROOT, 'src', 'assets-static', 'img');
const refs = new Set();
const scan = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) scan(p); else if (/\.(html|css)$/.test(f.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(/(?:assets\/|\.\.\/)img\/([A-Za-z0-9._-]+)/g)) refs.add(m[1]); } };
scan(OUT);
fs.mkdirSync(path.join(OUT, 'assets', 'img'), { recursive: true });
const missingImg = [];
for (const f of refs) { const s = path.join(IMG_SRC, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(OUT, 'assets', 'img', f)); else missingImg.push(f); }

// ---- robots + sitemap (live robots verbatim; --preview: disallow all)
// the live robots.txt, carried in src/content (a copy of audit/robots.txt, the crawl's evidence) so a repo copy builds alone
const liveRobots = fs.readFileSync(path.join(ROOT, 'src', 'content', 'robots.txt'), 'utf8');
fs.writeFileSync(path.join(OUT, 'robots.txt'), PREVIEW ? 'User-agent: *\nDisallow: /\n' : liveRobots);
const urls = SITE.pages.filter((p) => p.path !== '404.html' && built.includes(p.id)).map((p) => (p.head.canonical || (META_NEW[p.id] || {}).canonical)).filter(Boolean);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);

// ---- report + a content hash of the build
const hash = crypto.createHash('sha256');
const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p); else { hash.update(path.relative(OUT, p)); hash.update(fs.readFileSync(p)); } } };
walk(OUT);
console.log(`built ${built.length} page(s): ${built.join(', ')}`);
if (skipped.length) console.log(`skipped ${skipped.length}: ${skipped.join('; ')}`);
console.log(`images copied: ${refs.size - missingImg.length}${missingImg.length ? `; MISSING: ${missingImg.join(', ')}` : ''}`);
console.log(`dist sha256 ${hash.digest('hex').slice(0, 16)}${PREVIEW ? ' (preview: noindex)' : ''}`);
if (missingImg.length) process.exit(1);
