#!/usr/bin/env node
// a11y-axe.mjs - axe-core 4.10.2 (vendored, audit/vendor/axe-4.10.2.min.js) over the built pages in headless Chromium.
// Tags: wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice. Each --paths page is scanned at each viewport with the 21+
// gate pre-answered (localStorage sad-age-verified), lazy content scrolled in; plus the HOME page once per viewport with
// the gate OPEN (first visit). reducedMotion 'reduce'. Third-party requests are aborted (recorded) unless
// --allow-third-party. axe is a test tool: it is injected, never part of the page.
//
// USAGE (through the browser lock; refuses to start without it unless --unlocked):
//   sh src/tools/browser-lock.sh node src/tools/a11y-axe.mjs [--dir dist] [--paths home,about/ | --all]
//        [--vp 1440x900,390x844] [--json audit/axe.json] [--strict] [--no-gate] [--allow-third-party]
//        [--axe audit/vendor/axe-4.10.2.min.js] [--site src/content/site.json] [--watchdog <s>] [--unlocked]
// Prints every violation node (rule id, impact, target, html snippet).
// EXIT 0 = no serious/critical violation (moderate/minor are reported as WARN; --strict fails on any violation);
//      1 = serious/critical (or any, --strict) OR a scan that ran 0 axe rules (a comparison of nothing is not a pass);
//      2 = usage / not under the lock; 3 = watchdog.
// Self-test: covered by src/tools/check-selftest.mjs (clean fixture passes, image-alt / button-name mutants fail).
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const die = (c, m) => { console.error('axe: ' + m); process.exit(c); };
if (!process.env.BROWSER_LOCK_SLOT && !has('unlocked')) die(2, 'run me through the browser lock: sh src/tools/browser-lock.sh node src/tools/a11y-axe.mjs ... (or pass --unlocked)');
const DIR = path.resolve(ROOT, opt('dir', 'dist')); if (!fs.existsSync(DIR)) die(2, `--dir ${DIR} does not exist`);
const AXE = path.resolve(ROOT, opt('axe', 'audit/vendor/axe-4.10.2.min.js')); if (!fs.existsSync(AXE)) die(2, `axe not found at ${AXE}`);
const PATHS = has('all') ? JSON.parse(fs.readFileSync(path.resolve(ROOT, opt('site', 'src/content/site.json')), 'utf8')).pages.map((p) => p.path)
  : opt('paths', 'home').split(',').map((p) => p.trim()).filter(Boolean).map((p) => (p === 'home' || p === '/' ? '' : p.replace(/^\//, '')));
const VPS = opt('vp', '1440x900,390x844').split(',').map((s) => { const m = /^(\d+)x(\d+)$/.exec(s.trim()); if (!m) die(2, `bad viewport ${s}`); return { w: +m[1], h: +m[2], key: s.trim() }; });
const OUT = path.resolve(ROOT, opt('json', 'audit/axe.json'));
const STRICT = has('strict'); const GATE = !has('no-gate'); const ALLOW_3P = has('allow-third-party');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const WATCHDOG_S = +opt('watchdog', String(Math.min(5400, 180 + (PATHS.length + 1) * VPS.length * 60)));
let STEP = 'starting';
const scans = [];
const write = (extra) => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ tool: 'a11y-axe.mjs', axe: '4.10.2', at: new Date().toISOString(), dir: path.relative(ROOT, DIR), tags: TAGS, strict: STRICT, lockSlot: process.env.BROWSER_LOCK_SLOT || null, ...extra, scans }, null, 1)); };
setTimeout(() => { write({ aborted: `watchdog ${WATCHDOG_S}s during ${STEP}` }); console.error(`axe: WATCHDOG - exceeded ${WATCHDOG_S} s during "${STEP}" (machine load?). Ended with exit 3.`); process.exit(3); }, WATCHDOG_S * 1000).unref();
const { chromium } = require(process.env.PW_CORE || '/Users/carlcelino/OSOFT/.claude/skills/client-site-build/scripts/node_modules/playwright-core');

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); } catch (e) { res.writeHead(400); res.end(); return; }
  let f = path.join(DIR, p); if (f !== DIR && !f.startsWith(DIR + path.sep)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) { if (!p.endsWith('/')) { res.writeHead(301, { location: p + '/' }); res.end(); return; } f = path.join(f, 'index.html'); }
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const axeSrc = fs.readFileSync(AXE, 'utf8');
const key = (p) => (p === '' ? 'home' : p.replace(/\/$/, '').replace(/\//g, '-'));

async function scan(browser, pathname, vp, gateOpen) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: vp.w < 768, hasTouch: vp.w < 768, timezoneId: 'America/New_York', locale: 'en-US' });
  ctx.setDefaultTimeout(30000); ctx.setDefaultNavigationTimeout(60000);
  const third = new Set();
  if (!gateOpen) await ctx.addInitScript(() => { try { localStorage.setItem('sad-age-verified', JSON.stringify({ v: 1, at: Date.now() })); } catch (e) {} });
  await ctx.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE) || ALLOW_3P) return r.continue(); third.add(u.slice(0, 140)); return r.abort('blockedbyclient'); });
  try {
    const page = await ctx.newPage();
    await page.goto(BASE + pathname, { waitUntil: 'load' });
    await page.evaluate(async () => { try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]); } catch (e) {} });
    if (!gateOpen) await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 40)); } scrollTo({ top: 0, behavior: 'instant' }); });
    await page.waitForTimeout(200);
    const gateShown = await page.evaluate(() => { const g = document.getElementById('age-gate'); return !!g && g.getClientRects().length > 0 && getComputedStyle(g).display !== 'none'; });
    await page.addScriptTag({ content: axeSrc });
    const r = await page.evaluate(async (tags) => {
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
      const snip = (h) => (h || '').replace(/\s+/g, ' ').slice(0, 180);
      return { rulesRun: res.passes.length + res.violations.length + res.incomplete.length, passes: res.passes.length, passNodes: res.passes.reduce((t, x) => t + x.nodes.length, 0), incomplete: res.incomplete.map((x) => ({ id: x.id, impact: x.impact, count: x.nodes.length })),
        violations: res.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, helpUrl: x.helpUrl, count: x.nodes.length, nodes: x.nodes.map((n) => ({ target: n.target.join(' '), html: snip(n.html), why: (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 240) })) })) };
    }, TAGS);
    return { page: key(pathname), vp: vp.key, state: gateOpen ? 'age gate open (first visit)' : 'gate answered, page as seen', gateShown, thirdParty: [...third], ...r };
  } finally { await ctx.close().catch(() => {}); }
}

let code = 1; let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const p of PATHS) for (const vp of VPS) { STEP = `${key(p)} @${vp.key}`; scans.push(await scan(browser, p, vp, false)); }
  if (GATE) for (const vp of VPS) { STEP = `home gate @${vp.key}`; const s = await scan(browser, '', vp, true); scans.push(s); }
  let bad = 0, warn = 0, empty = 0;
  for (const s of scans) {
    const sev = s.violations.filter((v) => STRICT || v.impact === 'serious' || v.impact === 'critical'); const soft = s.violations.filter((v) => !sev.includes(v));
    const gateNote = s.state.startsWith('age gate') && !s.gateShown ? ' [gate did NOT show: FAIL]' : '';
    if (!s.rulesRun || gateNote) empty++;
    bad += sev.length; warn += soft.length;
    console.log(`${sev.length || !s.rulesRun || gateNote ? 'FAIL' : soft.length ? 'WARN' : 'ok  '} ${s.page} @${s.vp} (${s.state}): ${s.rulesRun} rules run, ${s.passNodes} passing nodes, ${s.violations.length} violation group(s)${gateNote}`);
    for (const v of s.violations) for (const n of v.nodes) console.log(`   ${sev.includes(v) ? 'X' : '~'} ${v.id} [${v.impact}] ${n.target} :: ${n.html}${n.why ? ' :: ' + n.why.slice(0, 140) : ''}`);
  }
  write({ summary: { scans: scans.length, failingGroups: bad, warningGroups: warn, emptyScans: empty } });
  console.log(`\nreport: ${path.relative(ROOT, OUT)}`);
  const ok = !bad && !empty && scans.length > 0;
  console.log(ok ? `axe: PASS (${scans.length} scans, 0 ${STRICT ? '' : 'serious/critical '}violations${warn ? `, ${warn} moderate/minor group(s) reported` : ''})` : `axe: FAIL (${bad} ${STRICT ? '' : 'serious/critical '}violation group(s)${empty ? `, ${empty} scan(s) that measured nothing or lost the gate` : ''} in ${scans.length} scans)`);
  code = ok ? 0 : 1;
} catch (e) { console.error(`axe: crashed during ${STEP}: ${e && e.stack || e}`); write({ aborted: String(e) }); code = 1; }
finally { if (browser) await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]); server.close(); }
process.exit(code);
