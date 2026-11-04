#!/usr/bin/env node
// shoot.mjs — look at the build: viewport screenshots of a page at given viewports, either at the top or with a named
// section parked under the header, or full-page. Age gate pre-answered unless --gate. Run through browser-lock.sh.
//   node src/tools/shoot.mjs --path home|about/|… [--vp 1440x900,390x844] [--sections hero,categories] [--full] [--gate]
//                            [--motion] [--out audit/shots/lead] [--dir dist]
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || '/Users/carlcelino/OSOFT/.claude/skills/client-site-build/scripts/node_modules/playwright-core');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(ROOT, opt('dir', 'dist'));
const P = opt('path', 'home'); const PG = P === 'home' ? '' : P;
const VPS = opt('vp', '1440x900,390x844').split(',').map((s) => s.split('x').map(Number));
const SECS = opt('sections', '') ? opt('sections', '').split(',') : [];
const FULL = process.argv.includes('--full'); const GATE = process.argv.includes('--gate'); const MOTION = process.argv.includes('--motion');
const OUT = path.resolve(ROOT, opt('out', 'audit/shots/lead'));
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); process.exit(3); }, 8 * 60 * 1000).unref();
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIR, p); if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const [w, h] of VPS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: MOTION ? 'no-preference' : 'reduce', isMobile: w < 768, hasTouch: w < 768 });
    if (!GATE) await ctx.addInitScript(() => { try { localStorage.setItem('sad-age-verified', JSON.stringify({ v: 1, at: Date.now() })); } catch (e) {} });
    await ctx.route('**/*', (rt) => (rt.request().url().startsWith(BASE) ? rt.continue() : rt.abort()));
    const page = await ctx.newPage();
    // --at <ISO time>: fix the clock so the live status / today's deal are the same in every shot (pixel diffs)
    if (opt('at', '')) await page.clock.setFixedTime(new Date(opt('at', '')));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h} ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${w}x${h} pageerror ${e.message}`));
    await page.goto(BASE + PG, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(MOTION ? 1500 : 400);
    const tag = (P === 'home' ? 'home' : P.replace(/\/$/, '').replace(/\//g, '-')) + `-${w}x${h}`;
    if (FULL) {
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
      await page.waitForTimeout(500);
      const H = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.screenshot({ path: path.join(OUT, tag + '-full.png'), fullPage: true, ...(H > 14000 ? { clip: { x: 0, y: 0, width: w, height: 14000 } } : {}) });
      console.log(`${tag}-full.png H=${H}`);
    }
    if (!SECS.length && !FULL) { await page.screenshot({ path: path.join(OUT, tag + '-top.png') }); console.log(`${tag}-top.png`); }
    for (const s of SECS) {
      const ok = await page.evaluate((id) => { const el = document.getElementById(id) || document.querySelector('.' + id) || document.querySelector(`[aria-labelledby="${id}"]`); if (!el) return false; el.scrollIntoView({ block: 'start', behavior: 'instant' }); return true; }, s);
      await page.waitForTimeout(350);
      if (!ok) { console.log(`no section ${s}`); continue; }
      const m = await page.evaluate((id) => { const el = document.getElementById(id) || document.querySelector('.' + id); const r = el.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; }, s);
      await page.screenshot({ path: path.join(OUT, `${tag}-${s}.png`) });
      console.log(`${tag}-${s}.png section top=${m.top} height=${m.h} (viewport ${h})`);
    }
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    if (sw[0] > sw[1]) console.log(`!! horizontal overflow ${sw[0]} > ${sw[1]} at ${w}x${h}`);
    await ctx.close();
  }
} finally { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]); server.close(); }
if (errors.length) console.log('console errors:\n  ' + errors.join('\n  '));
process.exit(0);
