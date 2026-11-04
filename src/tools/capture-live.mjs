#!/usr/bin/env node
// capture-live.mjs — the rendered evidence for every crawled page (the live site is a React SPA; the static crawl in
// audit/raw/ is the server's HTML, which for the homepage is an empty #root).
//
//   audit/pages/<slug>/rendered.html   the page as a browser draws it after the 21+ gate (inline scripts blanked)
//   audit/pages/<slug>/text.txt        document.body.innerText (what a visitor reads)
//   audit/pages/<slug>/harvest.json    head fields, heading tree, links, images, iframes, forms, buttons, sections,
//                                      hidden-text (textContent of collapsed parts), storage keys, request hosts
//   audit/pages/<slug>/live-1440.png, live-390.png   full-height screenshots (capped at 15000px)
//   audit/pages/_gate/gate-1440.png, gate-390.png    the age gate as first drawn
//
//   node src/tools/capture-live.mjs [--only index,about] [--no-shots]
// One browser, one page at a time, a pause between pages. Writes only inside the project.
import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || '/Users/carlcelino/OSOFT/.claude/skills/client-site-build/scripts/node_modules/playwright-core');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ONLY = opt('only', '') ? opt('only', '').split(',') : null;
const SHOTS = !process.argv.includes('--no-shots');
const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'site-inventory.json'), 'utf8'));
const urls = (inv.pages || inv).map((p) => p.url || p.finalUrl).filter(Boolean);
const slugOf = (u) => { const p = new URL(u).pathname.replace(/^\/|\/$/g, ''); return p ? p.replace(/\//g, '-') : 'index'; };
setTimeout(() => { console.error('WATCHDOG 45 min'); process.exit(3); }, 45 * 60 * 1000).unref();
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const redact = (h) => h.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, (m) => (/application\/ld\+json/.test(m) ? m : m.replace(/>[\s\S]*<\/script>$/i, '></script>')));

const HARVEST = () => {
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const meta = (sel) => (document.querySelector(sel) || {}).content || null;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({ level: +h.tagName[1], text: txt(h) || (h.textContent || '').trim(), visible: vis(h) }));
  const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href'), text: txt(a), aria: a.getAttribute('aria-label'), target: a.getAttribute('target'), inNav: !!a.closest('nav,header'), inFooter: !!a.closest('footer') }));
  const images = [...document.querySelectorAll('img')].map((i) => ({ src: i.currentSrc || i.src, attr: i.getAttribute('src'), alt: i.getAttribute('alt'), nw: i.naturalWidth, nh: i.naturalHeight, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height) }));
  const bgImages = [...document.querySelectorAll('*')].map((e) => getComputedStyle(e).backgroundImage).filter((b) => b && b.includes('url(')).filter((v, i, a) => a.indexOf(v) === i);
  const iframes = [...document.querySelectorAll('iframe')].map((f) => ({ src: f.getAttribute('src') || '', title: f.getAttribute('title') || '', id: f.id, w: f.width, h: f.height }));
  const forms = [...document.querySelectorAll('form')].map((f) => ({ action: f.getAttribute('action'), method: f.getAttribute('method'), text: txt(f).slice(0, 600), fields: [...f.querySelectorAll('input, textarea, select, button')].map((i) => ({ tag: i.tagName, type: i.getAttribute('type'), name: i.getAttribute('name'), id: i.id, placeholder: i.getAttribute('placeholder'), required: i.required, label: (i.id && document.querySelector(`label[for="${i.id}"]`)) ? txt(document.querySelector(`label[for="${i.id}"]`)) : (i.closest('label') ? txt(i.closest('label')) : ''), text: i.tagName === 'BUTTON' ? txt(i) : '', options: i.tagName === 'SELECT' ? [...i.options].map((o) => o.textContent.trim()) : undefined })) }));
  const buttons = [...document.querySelectorAll('button, [role=button], [role=tab]')].map((b) => ({ text: txt(b), aria: b.getAttribute('aria-label'), role: b.getAttribute('role'), selected: b.getAttribute('aria-selected') }));
  const sections = [...document.querySelectorAll('main > *, main section, body > div#root > div > *, section')].slice(0, 120).map((s) => ({ tag: s.tagName.toLowerCase(), id: s.id, cls: (s.className && s.className.baseVal === undefined ? s.className : '').toString().slice(0, 120), heading: txt(s.querySelector('h1,h2,h3') || document.createElement('i')).slice(0, 120), h: Math.round(s.getBoundingClientRect().height) }));
  const hidden = [];
  for (const el of document.querySelectorAll('body *')) { if (el.children.length) continue; const t = (el.textContent || '').replace(/\s+/g, ' ').trim(); if (t.length < 2 || el.closest('script,style,noscript')) continue; if (!vis(el)) hidden.push(t); }
  const store = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); store[k] = (localStorage.getItem(k) || '').slice(0, 200); } } catch (e) {}
  const session = {}; try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); session[k] = (sessionStorage.getItem(k) || '').slice(0, 200); } } catch (e) {}
  return { at: new Date().toISOString(), url: location.href, title: document.title, description: meta('meta[name="description"]'), canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
    og: Object.fromEntries([...document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]')].map((m) => [m.getAttribute('property') || m.getAttribute('name'), m.content])),
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent.trim()),
    headings, links, images, bgImages, iframes, forms, buttons, sections, hidden: [...new Set(hidden)], localStorage: store, sessionStorage: session, docH: document.documentElement.scrollHeight };
};

const GATE_SEL = ['button:has-text("Yes")', 'button:has-text("I am 21")', 'button:has-text("I\'m 21")', 'button:has-text("21 or older")', 'button:has-text("Enter")', 'a:has-text("Yes")'];
async function passGate(page) {
  for (const s of GATE_SEL) { const b = page.locator(s).first(); if (await b.isVisible().catch(() => false)) { const t = (await b.innerText().catch(() => '')).trim(); await b.click(); await page.waitForTimeout(1500); return t; } }
  return null;
}

const browser = await chromium.launch({ headless: true });
const summary = [];
try {
  const targets = urls.filter((u) => !ONLY || ONLY.includes(slugOf(u)));
  let gateShot = false;
  for (const url of targets) {
    const slug = slugOf(url); const dir = path.join(ROOT, 'audit', 'pages', slug); fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
    const page = await ctx.newPage();
    const reqs = []; const fails = []; const consoleErr = [];
    page.on('request', (r) => reqs.push({ url: r.url().slice(0, 300), type: r.resourceType() }));
    page.on('requestfailed', (r) => fails.push({ url: r.url().slice(0, 300), err: (r.failure() || {}).errorText }));
    page.on('console', (m) => { if (m.type() === 'error') consoleErr.push(m.text().slice(0, 300)); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2500);
    if (!gateShot && SHOTS) {
      const gdir = path.join(ROOT, 'audit', 'pages', '_gate'); fs.mkdirSync(gdir, { recursive: true });
      await page.screenshot({ path: path.join(gdir, 'gate-1440.png') });
      fs.writeFileSync(path.join(gdir, 'gate.html'), redact(await page.content()));
      fs.writeFileSync(path.join(gdir, 'gate-text.txt'), await page.evaluate(() => document.body.innerText));
    }
    const gate = await passGate(page);
    const H0 = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H0 + 900; y += 600) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(300); }
    await page.waitForTimeout(3000); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(600);
    const data = await page.evaluate(HARVEST);
    data.gateButton = gate; data.requestHosts = [...new Set(reqs.map((r) => { try { return new URL(r.url).host; } catch { return r.url; } }))];
    data.requests = reqs.filter((r) => !/\.(png|jpe?g|webp|gif|svg|woff2?)(\?|$)/i.test(r.url)).slice(0, 200); data.failedRequests = fails; data.consoleErrors = consoleErr;
    fs.writeFileSync(path.join(dir, 'harvest.json'), JSON.stringify(data, null, 1));
    fs.writeFileSync(path.join(dir, 'rendered.html'), redact(await page.content()));
    fs.writeFileSync(path.join(dir, 'text.txt'), await page.evaluate(() => document.body.innerText));
    if (SHOTS) {
      const H = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.screenshot({ path: path.join(dir, 'live-1440.png'), fullPage: true, ...(H > 15000 ? { clip: { x: 0, y: 0, width: 1440, height: 15000 } } : {}) });
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(1500);
      if (!gateShot) { /* gate already passed in this context; a fresh one shows it on phones */ }
      const H2 = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H2 + 844; y += 700) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(200); }
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(dir, 'live-390.png'), fullPage: true, ...(H2 > 15000 ? { clip: { x: 0, y: 0, width: 390, height: 15000 } } : {}) });
    }
    gateShot = true;
    await ctx.close();
    const line = `${slug}: h1 ${JSON.stringify(data.headings.filter((h) => h.level === 1).map((h) => h.text))}, ${data.headings.length} headings, ${data.links.length} links, ${data.images.length} imgs, ${data.iframes.length} iframes, ${data.forms.length} forms, gate=${gate}, errors=${consoleErr.length}, docH=${data.docH}`;
    console.log(line); summary.push(line);
    await new Promise((r) => setTimeout(r, 1500));
  }
} finally { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]); }
fs.writeFileSync(path.join(ROOT, 'audit', 'pages', '_summary.txt'), summary.join('\n') + '\n');
process.exit(0);
