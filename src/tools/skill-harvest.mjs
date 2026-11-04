#!/usr/bin/env node
// skill-harvest.mjs — drive the site-reforge skill's OWN browser payloads through headless Chromium, for the graded
// workspace reforge/ (see gate-workspace.mjs):
//   --side live     the LIVE pages after the 21+ gate: sr-capture (computed style) + sr-sweep baseline at every width,
//                   and sr-capture --emit-scroll (reveal motion) at 1440 and 390.
//   --side rebuild  the built dist/ (gate pre-answered): sr-sweep rebuild at the same widths.
//   node src/tools/skill-harvest.mjs --side live|rebuild [--pages /,/about] [--vp 1440x900,1024x768,768x1024,390x844]
// Writes reforge/audit/capture-in/{cap,scroll,sweep-baseline,sweep-rebuild}-<page>-<w>.json. One browser, one page at a time.
// Then merge: sr-capture --project reforge --merge <f> --side baseline ; sr-sweep --project reforge --merge <f> --side baseline|rebuild
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || '/Users/carlcelino/OSOFT/.claude/skills/client-site-build/scripts/node_modules/playwright-core');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SK = '/Users/carlcelino/.claude-osoft/skills/site-reforge/scripts';
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SIDE = opt('side', 'live');
const PAGES = opt('pages', '/').split(',');
const VPS = opt('vp', '1440x900,1024x768,768x1024,390x844').split(',').map((s) => { const [w, h] = s.split('x').map(Number); return { w, h }; });
const IN = path.join(ROOT, 'reforge', 'audit', 'capture-in'); fs.mkdirSync(IN, { recursive: true });
const emit = (flag, script) => { const f = path.join(IN, script); if (!fs.existsSync(f)) fs.writeFileSync(f, execFileSync('node', [path.join(SK, flag[0]), flag[1]], { maxBuffer: 1 << 26 })); return fs.readFileSync(f, 'utf8'); };
const CAP = emit(['sr-capture.mjs', '--emit'], 'capture.js');
const SCROLL = emit(['sr-capture.mjs', '--emit-scroll'], 'scroll.js');
const SWEEP = emit(['sr-sweep.mjs', '--emit'], 'sweep.js');
setTimeout(() => { console.error('WATCHDOG 30 min'); process.exit(3); }, 30 * 60 * 1000).unref();
const say = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const DIST = path.join(ROOT, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIST, p); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const LOCAL = 'http://127.0.0.1:' + server.address().port;
const LIVE = 'https://springfieldavedispensary.store';
const settle = async (page) => { await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); await document.fonts.ready; }); await page.waitForTimeout(800); };
const evalJson = async (page, src) => { const r = await page.evaluate(src); return typeof r === 'string' ? JSON.parse(r) : r; };
const slug = (p) => (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '-'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const browser = await chromium.launch({ headless: true });
try {
  for (const pg of PAGES) for (const vp of VPS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, userAgent: UA });
    if (SIDE === 'rebuild') {
      await ctx.addInitScript(() => { try { localStorage.setItem('sad-age-verified', JSON.stringify({ v: 1, at: Date.now() })); } catch (e) {} });
      await ctx.route(/^(?!http:\/\/127\.0\.0\.1)/, (r) => r.abort());
    }
    const page = await ctx.newPage();
    const url = SIDE === 'live' ? LIVE + pg : LOCAL + (pg === '/' ? '/' : pg.replace(/\/?$/, '/'));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(1500);
    if (SIDE === 'live') { const yes = page.locator('button:has-text("Yes")').first(); if (await yes.isVisible().catch(() => false)) { await yes.click(); await page.waitForTimeout(1500); } }
    await settle(page);
    const tag = `${slug(pg)}-${vp.w}`;
    if (SIDE === 'live') {
      const cap = await evalJson(page, CAP);
      if (!cap || (cap.viewport && cap.viewport.w && cap.viewport.w !== vp.w)) throw new Error('capture viewport mismatch at ' + vp.w + ' (got ' + (cap && cap.viewport && cap.viewport.w) + ')');
      fs.writeFileSync(path.join(IN, `cap-${tag}.json`), JSON.stringify(cap));
      if (vp.w === 1440 || vp.w === 390) { const sc = await evalJson(page, SCROLL); fs.writeFileSync(path.join(IN, `scroll-${tag}.json`), JSON.stringify(sc)); }
    }
    const sw = await evalJson(page, SWEEP);
    if (sw.viewport && sw.viewport.w !== vp.w) throw new Error('sweep viewport mismatch at ' + vp.w);
    fs.writeFileSync(path.join(IN, `sweep-${SIDE === 'live' ? 'baseline' : 'rebuild'}-${tag}.json`), JSON.stringify(sw));
    await ctx.close();
    say(SIDE, tag, 'ok');
    if (SIDE === 'live') await new Promise((r) => setTimeout(r, 1200));
  }
} finally { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]); server.close(); }
process.exit(0);
