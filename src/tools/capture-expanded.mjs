#!/usr/bin/env node
// capture-expanded.mjs — the text that live pages only draw after a click (FAQ answers, career role details, tabs).
// For each page: pass the 21+ gate, then click every collapsed control (aria-expanded="false", <summary>, buttons whose
// text matches a question / "WHAT YOU'LL DO"-style toggle) one at a time, and record the text that appeared.
//   audit/pages/<slug>/expanded.json  { clicks: [{ control, appeared: [lines] }], fullText }
//   node src/tools/capture-expanded.mjs --only contact,careers,index,shop,loyalty
import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || '/Users/carlcelino/OSOFT/.claude/skills/client-site-build/scripts/node_modules/playwright-core');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ONLY = opt('only', 'contact,careers').split(',');
setTimeout(() => { console.error('WATCHDOG 25 min'); process.exit(3); }, 25 * 60 * 1000).unref();
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'site-inventory.json'), 'utf8'));
const slugOf = (u) => { const p = new URL(u).pathname.replace(/^\/|\/$/g, ''); return p ? p.replace(/\//g, '-') : 'index'; };
const URLS = Object.fromEntries(inv.pages.map((p) => [slugOf(p.url), p.url]));
const browser = await chromium.launch({ headless: true });
try {
  for (const slug of ONLY) {
    const url = URLS[slug]; if (!url) { console.error('unknown slug ' + slug); continue; }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const yes = page.locator('button:has-text("Yes")').first(); if (await yes.isVisible().catch(() => false)) { await yes.click(); await page.waitForTimeout(1200); }
    const lines = async () => (await page.evaluate(() => document.body.innerText)).split('\n').map((s) => s.trim()).filter(Boolean);
    // candidate controls, tagged so the order is stable
    const SEL = opt('sel', '');
    const n = await page.evaluate((SEL) => {
      if (SEL) { const c = [...document.querySelectorAll(SEL)]; c.forEach((b, i) => b.setAttribute('data-xp', i)); return c.length; }
      const c = [...document.querySelectorAll('[aria-expanded="false"], summary, button, [role=tab]')].filter((b) => {
        if (b.closest('header, nav, footer, form')) return false;
        const t = (b.innerText || '').trim();
        return b.getAttribute('aria-expanded') === 'false' || b.tagName === 'SUMMARY' || b.getAttribute('role') === 'tab' || /\?$/.test(t) || /WHAT YOU|LOOKING FOR|DETAILS|MORE|READ/i.test(t);
      });
      c.forEach((b, i) => b.setAttribute('data-xp', i));
      return c.length;
    }, SEL);
    const clicks = [];
    for (let i = 0; i < n; i++) {
      const before = new Set(await lines());
      const loc = page.locator(`[data-xp="${i}"]`);
      const label = ((await loc.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ').slice(0, 160);
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await loc.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      const appeared = (await lines()).filter((l) => !before.has(l));
      const dialog = SEL ? await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? { text: d.innerText, html: d.outerHTML.replace(/\sclass="[^"]*"/g, '').slice(0, 6000) } : null; }) : null;
      clicks.push({ control: label, appeared, dialog });
      if (SEL) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    }
    const fullText = await lines();
    fs.writeFileSync(path.join(ROOT, 'audit', 'pages', slug, opt('out', 'expanded') + '.json'), JSON.stringify({ url, at: new Date().toISOString(), clicks, fullText }, null, 1));
    console.log(`${slug}: ${n} controls, ${clicks.reduce((a, c) => a + c.appeared.length, 0)} lines appeared`);
    await ctx.close();
    await new Promise((r) => setTimeout(r, 1200));
  }
} finally { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]); }
process.exit(0);
