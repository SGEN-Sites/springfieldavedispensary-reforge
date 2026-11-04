#!/usr/bin/env node
// tokenize-colors.mjs — keep every colour VALUE in tokens.css (brief + skill gate C13: change values in tokens.css, never at
// a call site). For each sheet given (default: the lead's top-level sheets src/styles/*.css except tokens.css, plus
// src/styles/pages/home/01-03*.css):
//   rgb(var(--t) / a)        -> color-mix(in srgb, var(--t-c) A%, transparent)     (--t is a "r g b" triplet token;
//   rgb(var(--t))            -> var(--t-c)                                          --t-c = its hex twin, added to tokens.css)
//   rgb(r g b / a), #hex     -> the token whose colour is within ±TOL per channel, as var(--tok) or color-mix(... A%, transparent)
// Anything left unmatched is listed (exit 1) so it can be named as a token by hand. Dry run unless --write.
//   node src/tools/tokenize-colors.mjs [--write] [--tol 6] [--files a.css,b.css]
// color-mix(in srgb, X A%, transparent) == X at alpha A (CSS Color 5 mixes premultiplied).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STY = path.join(ROOT, 'src', 'styles');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const WRITE = process.argv.includes('--write');
const TOL = Number(opt('tol', '6'));
const tokFile = path.join(STY, 'tokens.css');
const files = opt('files', '') ? opt('files', '').split(',').map((f) => path.resolve(ROOT, f)) : [
  ...fs.readdirSync(STY).filter((f) => f.endsWith('.css') && f !== 'tokens.css').map((f) => path.join(STY, f)),
  ...fs.readdirSync(path.join(STY, 'pages', 'home')).filter((f) => /^0[1-3]-.*\.css$/.test(f)).map((f) => path.join(STY, 'pages', 'home', f)),
];
let tok = fs.readFileSync(tokFile, 'utf8');
const hexTo = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (a) => '#' + a.map((n) => n.toString(16).padStart(2, '0')).join('');
// triplet tokens and their hex twins
const triplets = {};
for (const m of tok.matchAll(/^\s*(--[\w-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/gm)) triplets[m[1]] = [m[2], m[3], m[4]].map(Number);
const twinsToAdd = Object.entries(triplets).filter(([t]) => !new RegExp(`${t}-c:`).test(tok)).map(([t, v]) => `  ${t}-c: ${toHex(v)};`);
// colour tokens (hex) available for literal matching: existing hex tokens + twins + named helpers
const NAMED = { '--white': '#ffffff', '--black': '#000000', '--seal-cream-hi': '#fffdf6', '--seal-cream': '#efe8d6', '--seal-cream-lo': '#e2d9c2', '--closed': '#e98a6c', '--danger-ink': '#ffb4a2', '--soon-ink': '#f8deb9', '--mint-line': '#e4ffee' };
const namedToAdd = Object.entries(NAMED).filter(([t]) => !new RegExp(`${t}:`).test(tok)).map(([t, v]) => `  ${t}: ${v};`);
const palette = [];
for (const m of tok.matchAll(/^\s*(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/gm)) if (m[2].length === 4 || m[2].length === 7) palette.push([m[1], hexTo(m[2])]);
for (const [t, v] of Object.entries(triplets)) palette.push([t + '-c', v]);
for (const [t, h] of Object.entries(NAMED)) if (!palette.some(([p]) => p === t)) palette.push([t, hexTo(h)]);
const nearest = (rgb) => { let best = null; for (const [t, v] of palette) { const d = Math.max(...v.map((x, i) => Math.abs(x - rgb[i]))); if (d <= TOL && (!best || d < best.d)) best = { t, d }; } return best; };
const pct = (a) => `${Math.round(parseFloat(a) * 1000) / 10}%`;
const mix = (t, a) => (a == null || parseFloat(a) >= 1 ? `var(${t})` : `color-mix(in srgb, var(${t}) ${pct(a)}, transparent)`);
const report = { rewrites: 0, approx: [], left: [] };
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // keep comments untouched: split them out
  const parts = src.split(/(\/\*[\s\S]*?\*\/)/);
  for (let i = 0; i < parts.length; i += 2) {
    let s = parts[i];
    s = s.replace(/rgba?\(\s*var\((--[\w-]+)\)\s*(?:\/\s*([.\d]+)\s*)?\)/g, (m, t, a) => { if (!triplets[t]) return m; report.rewrites++; return mix(t + '-c', a); });
    s = s.replace(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[\/,]\s*([.\d]+)\s*)?\)/g, (m, r, g, b, a) => {
      const n = nearest([+r, +g, +b]); if (!n) { report.left.push(`${path.relative(ROOT, f)}: ${m}`); return m; }
      if (n.d) report.approx.push(`${m} -> ${n.t} (±${n.d})`); report.rewrites++; return mix(n.t, a);
    });
    s = s.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m) => {
      const n = nearest(hexTo(m)); if (!n) { report.left.push(`${path.relative(ROOT, f)}: ${m}`); return m; }
      if (n.d) report.approx.push(`${m} -> ${n.t} (±${n.d})`); report.rewrites++; return `var(${n.t})`;
    });
    parts[i] = s;
  }
  const out = parts.join('');
  if (WRITE && out !== src) fs.writeFileSync(f, out);
}
if (WRITE && (twinsToAdd.length || namedToAdd.length)) {
  const block = `\n  /* hex twins of the light triplets (alpha via color-mix) + named helper colours */\n${[...twinsToAdd, ...namedToAdd].join('\n')}\n`;
  tok = tok.replace(/(\n  --accent-glow:[^\n]*\n)/, `$1${block}`);
  if (!tok.includes(block)) throw new Error('could not place the twin block in tokens.css');
  fs.writeFileSync(tokFile, tok);
}
console.log(`${WRITE ? 'rewrote' : 'would rewrite'} ${report.rewrites} colour(s) in ${files.length} sheet(s); tokens to add: ${[...twinsToAdd, ...namedToAdd].length}`);
if (report.approx.length) console.log('approximate matches (within ±' + TOL + '/255 per channel):\n  ' + [...new Set(report.approx)].join('\n  '));
if (report.left.length) { console.log('UNMATCHED (name a token):\n  ' + [...new Set(report.left)].join('\n  ')); process.exit(1); }
