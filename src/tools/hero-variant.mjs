#!/usr/bin/env node
// hero-variant.mjs — build the REAL homepage with an alternative hero swapped in (owner options, not the deliverable).
//   node src/tools/hero-variant.mjs --variant a [--out audit/labs/hero-options/a/dist]
// A variant lives in src/labs/hero-options/<v>/: hero.mjs (export function render(ctx) — same ctx as
// src/sections/home/01-hero.mjs; must return ONE <section class="hero …" data-hero …> with a [data-primary-cta]),
// hero.css (replaces the 01-hero.css block in home.css), and optionally assets/ (copied to <out>/assets/hero-<v>/;
// reference them from hero.css as url("../hero-<v>/<file>") and from hero.mjs as link('assets/hero-<v>/<file>')).
// Everything else on the page is the current build, byte for byte.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const V = opt('variant', ''); if (!/^[a-z0-9-]+$/.test(V)) { console.error('--variant <a|b|c> required'); process.exit(2); }
const VDIR = path.join(ROOT, 'src', 'labs', 'hero-options', V);
const OUT = path.resolve(ROOT, opt('out', `audit/labs/hero-options/${V}/dist`));
execFileSync('node', [path.join(ROOT, 'src', 'tools', 'build.mjs'), '--only', 'home', '--out', OUT], { stdio: 'inherit' });
const { makeLink } = await import(pathToFileURL(path.join(ROOT, 'src', 'lib', 'h.mjs')).href);
const mod = await import(pathToFileURL(path.join(VDIR, 'hero.mjs')).href + '?t=' + fs.statSync(path.join(VDIR, 'hero.mjs')).mtimeMs);
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const ctx = { page: J('src/content/site.json').pages.find((p) => p.id === 'index'), S: J('src/content/shared.json'), link: makeLink(''), content: J('src/content/pages/index.json'), root: ROOT };
const heroHtml = mod.render(ctx);
if (!/^\s*<section\b[^>]*\bclass="[^"]*\bhero\b[^"]*"[^>]*\bdata-hero\b/.test(heroHtml)) throw new Error('variant must return a <section class="hero …" data-hero>');
if (!/data-primary-cta/.test(heroHtml)) throw new Error('variant hero has no [data-primary-cta]');
const idx = path.join(OUT, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
const start = html.indexOf('<section class="hero'); const end = html.indexOf('</section>', start);
if (start < 0 || end < 0) throw new Error('could not find the hero section in the built page');
// the hero's own markup has nested elements but no nested <section>, so the first </section> closes it
html = html.slice(0, start) + heroHtml.trim() + html.slice(end + '</section>'.length);
fs.writeFileSync(idx, html);
const cssFile = path.join(OUT, 'assets', 'css', 'home.css');
let css = fs.readFileSync(cssFile, 'utf8');
const a = css.indexOf('/* pages/home/01-hero.css */'); const b = css.indexOf('/* pages/home/02-', a);
if (a < 0 || b < 0) throw new Error('01-hero.css block not found in home.css');
css = css.slice(0, a) + `/* labs/hero-options/${V}/hero.css (owner option) */\n` + fs.readFileSync(path.join(VDIR, 'hero.css'), 'utf8') + '\n' + css.slice(b);
fs.writeFileSync(cssFile, css);
const va = path.join(VDIR, 'assets');
if (fs.existsSync(va)) fs.cpSync(va, path.join(OUT, 'assets', `hero-${V}`), { recursive: true });
// images the variant references that the base build did not copy
for (const m of new Set([...heroHtml.matchAll(/assets\/img\/([A-Za-z0-9._-]+)/g)].map((x) => x[1]))) {
  const s = path.join(ROOT, 'src', 'assets-static', 'img', m), d = path.join(OUT, 'assets', 'img', m);
  if (!fs.existsSync(d)) { if (!fs.existsSync(s)) throw new Error('variant references a missing image ' + m); fs.copyFileSync(s, d); }
}
console.log(`variant ${V}: hero swapped into ${path.relative(ROOT, idx)} (+ hero.css${fs.existsSync(va) ? ', assets' : ''})`);
