#!/usr/bin/env node
// hero-board.mjs — the owner's comparison board for the hero options: the CURRENT hero + each option, every one a live
// homepage in a desktop frame (1440x900) and a phone frame (390x844), side by side, scrollable, motion on.
//   node src/tools/hero-board.mjs            reads audit/labs/hero-options/options.json, writes audit/labs/hero-options/index.html
// Serve audit/labs/hero-options/ (all frames are same-origin, so the board pre-answers the 21+ gate once for all of them).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(ROOT, 'audit', 'labs', 'hero-options');
const opts = JSON.parse(fs.readFileSync(path.join(DIR, 'options.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const card = (o) => `<section class="opt" id="opt-${esc(o.key)}">
 <header class="opt__head"><p class="opt__tag">${esc(o.label)}</p><h2>${esc(o.name)}</h2><p class="opt__text">${esc(o.concept)}</p>
  ${o.phones ? `<p class="opt__phones"><b>On phones:</b> ${esc(o.phones)}</p>` : ''}
  <p class="opt__links"><a href="${esc(o.key)}/dist/index.html" target="_blank" rel="noopener">Open the full page ↗</a></p></header>
 <div class="opt__frames">
  <div class="frame frame--desk"><div class="frame__scale"><iframe src="${esc(o.key)}/dist/index.html" width="1440" height="900" loading="lazy" title="${esc(o.name)} — desktop 1440 x 900"></iframe></div><span>Desktop 1440 × 900</span></div>
  <div class="frame frame--phone"><div class="frame__scale"><iframe src="${esc(o.key)}/dist/index.html" width="390" height="844" loading="lazy" title="${esc(o.name)} — phone 390 x 844"></iframe></div><span>Phone 390 × 844</span></div>
 </div>
</section>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hero options — Springfield Ave Dispensary</title>
<script>try{localStorage.setItem('sad-age-verified',JSON.stringify({v:1,at:Date.now()}))}catch(e){}</script>
<style>
:root{color-scheme:dark;--bg:#07110b;--ink:#f5f0e6;--ink2:#cfc8bb;--ink3:#a39d91;--line:rgba(228,255,238,.14);--lime:#a3ce0c}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(80vw 50vh at 20% 0,rgba(56,196,124,.14),transparent 70%),var(--bg);color:var(--ink2);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;padding:32px clamp(16px,3vw,40px) 80px}
h1{font:800 clamp(26px,3vw,40px)/1.1 system-ui;color:var(--ink);margin:0 0 6px;letter-spacing:-.02em}
.lede{max-width:80ch;margin:0 0 10px}.nav{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 8px}
.nav a{color:var(--ink);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:8px 16px}.nav a:hover{border-color:var(--lime)}
.opt{border-top:1px solid var(--line);padding:34px 0 10px}
.opt__head{max-width:1100px}.opt__tag{margin:0;font:700 12px/1 system-ui;letter-spacing:.2em;text-transform:uppercase;color:var(--lime)}
.opt h2{font:800 clamp(22px,2.2vw,30px)/1.15 system-ui;color:var(--ink);margin:8px 0}.opt__text,.opt__phones{max-width:90ch;margin:0 0 8px}
.opt__links a{color:var(--lime)}
.opt__frames{display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start;margin-top:18px}
.frame span{display:block;margin-top:8px;font-size:13px;color:var(--ink3)}
.frame__scale{overflow:hidden;border:1px solid var(--line);border-radius:14px;box-shadow:0 30px 80px -40px #000}
.frame--desk .frame__scale{width:calc(1440px * var(--s));height:calc(900px * var(--s));--s:.62}
.frame--phone .frame__scale{width:calc(390px * var(--s));height:calc(844px * var(--s));--s:.66;border-radius:22px}
.frame iframe{border:0;transform:scale(var(--s));transform-origin:0 0;display:block;background:#000}
.frame--desk iframe{--s:.62}.frame--phone iframe{--s:.66}
@media (max-width:1300px){.frame--desk .frame__scale,.frame--desk iframe{--s:.45}}
@media (max-width:900px){.frame--desk .frame__scale,.frame--desk iframe{--s:.36}}
</style></head><body>
<h1>Hero options — street-sign inspiration</h1>
<p class="lede">Each frame is the real homepage with that hero swapped in (same live copy, CTAs and stats, same sections below). The frames are live: scroll them, hover, and use “Pause motion”. Pick one, or combine parts.</p>
<nav class="nav">${opts.map((o) => `<a href="#opt-${esc(o.key)}">${esc(o.label)}: ${esc(o.name)}</a>`).join('')}</nav>
${opts.map(card).join('\n')}
</body></html>`;
fs.writeFileSync(path.join(DIR, 'index.html'), html);
console.log('board: ' + path.relative(ROOT, path.join(DIR, 'index.html')) + ' (' + opts.length + ' options)');
