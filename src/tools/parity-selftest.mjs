#!/usr/bin/env node
// parity-selftest.mjs — proves that parity.mjs PASSES a build that carries everything live and FAILS each broken one.
//
// Usage:  node src/tools/parity-selftest.mjs [--keep]
//   1. Builds a FIXTURE dist under audit/labs/t1/fixture-dist/ from the live evidence itself: each live page's
//      audit/pages/<id>/rendered.html is written to its built path (site.json path; '' -> index.html) with only the
//      changes a real build makes: the live chrome <nav> wrapped in <header class="site-header">, class site-footer
//      on the live <footer> (header/footer content copied as-is), data-api="<live endpoint>" on each form,
//      root-absolute hrefs ("/about", "/shop?dtche[category]=flower") rewritten relative to the built file (query and
//      hash verbatim), the text a visitor reveals by clicking appended (contact FAQ answers from expanded.json, the
//      seven deal dialogs' live HTML from index/deal-modals.json), and the index <h1> replaced by the real build's
//      markup <h1><span>Elevating</span> <span><span class="accent">Irvington</span>, NJ</span></h1>. The two new
//      pages (deals, 404.html) get a title + description + canonical and the index chrome.
//   2. Runs parity on it as a child process and expects exit 0 / PASS with non-zero counts.
//   3. Applies each mutant on a copy, one at a time, and expects exit 1 (or 2 where stated) AND the specific finding
//      (code + page + text/href/field) in the JSON report — a FAIL for some other reason does not count as caught.
//      Mutants (a)-(i) are the lead's list; the rest cover the remaining rules (C2, C3 og/ld, C4 query/root-absolute/
//      external, C5 case, C6 endpoint, new-page meta, removals, dynamic runs, not-ready, zero-count).
//   4. A one-page JOIN fixture (audit/labs/t1/fixture-join/: its own site.json, evidence and dist) for the
//      text-joining rule, where "Irvington, NJ" occurs exactly once: live <h1>Elevating<br><span>Irvington, NJ</span>
//      </h1> vs built inline-span h1 => PASS; comma dropped => FAIL; the two halves in block elements => FAIL; a live
//      page with no links => FAIL (ZERO: a comparison of nothing is not a pass).
//   Report: audit/labs/t1/parity-selftest.json. Exit 0 only when every clean run passes and every mutant is caught.
//   Node 18+ builtins only; no browser. Output ends with "SELFTEST parity: N/N mutants caught, clean PASS".

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse, qs, qsa, closest, textOf, textRuns, norm } from './lib-text.mjs';

setTimeout(() => { console.error('SELFTEST parity: watchdog timeout (25 min)'); process.exit(3); }, 25 * 60 * 1000).unref();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = path.resolve(HERE, '..', '..');
const TOOL = path.join(HERE, 'parity.mjs');
const LAB = path.join(P, 'audit', 'labs', 't1');
const FIX = path.join(LAB, 'fixture-dist');
const MUT = path.join(LAB, 'mutant-dist');
const EVID = path.join(P, 'audit', 'pages');
const KEEP = process.argv.includes('--keep');
const FORM_API = { index: '/api/newsletter/subscribe', contact: '/api/contact', careers: '/api/careers/apply' };
const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const site = readJSON(path.join(P, 'src/content/site.json'));
const builtPathOf = (pg) => (pg.path === '' ? 'index.html' : pg.path.endsWith('/') ? pg.path + 'index.html' : pg.path);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const BUILT_H1 = '<h1 id="hero-title"><span class="hero__l1">Elevating</span> <span class="hero__l2"><span class="accent">Irvington</span>, NJ</span></h1>';

// ---------------------------------------------------------------- string surgery
// edits: [{start, end, text}] on the ORIGINAL source; applied right-to-left; overlapping edits are a bug (throw).
function applyEdits(src, edits) {
  const es = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let out = src; let floor = Infinity;
  for (const e of es) {
    if (e.end > floor) throw new Error(`overlapping edits at ${e.start}-${e.end}`);
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    floor = e.start;
  }
  return out;
}
const startTag = (src, n) => src.slice(n.start, n.startTagEnd);
const ATTR_RE = (name) => new RegExp(`(\\s${name}\\s*=\\s*)("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
// replace / add / remove one attribute of element n (returns an edit on the start tag)
function attrEdit(src, n, name, value) {
  const tag = startTag(src, n);
  const re = ATTR_RE(name);
  let t;
  if (re.test(tag)) t = value === null ? tag.replace(re, '') : tag.replace(re, (m, pre) => `${pre}"${esc(value)}"`);
  else if (value === null) return null;
  else t = tag.replace(/^<([A-Za-z][^\s/>]*)/, (m) => `${m} ${name}="${esc(value)}"`);
  return { start: n.start, end: n.startTagEnd, text: t };
}
function relHref(raw, fromBuilt) {
  const qi = raw.search(/[?#]/);
  const pathPart = qi >= 0 ? raw.slice(0, qi) : raw;
  const tail = qi >= 0 ? raw.slice(qi) : '';
  const target = pathPart.replace(/^\/+|\/+$/g, '');
  const fromDir = path.posix.dirname(fromBuilt) === '.' ? '' : path.posix.dirname(fromBuilt);
  let r = path.posix.relative(fromDir, target);
  r = r === '' ? './' : (r.startsWith('.') ? r : './' + r) + '/';
  return r + tail;
}
const liveChrome = (root) => ({
  nav: qs(root, 'header') || qsa(root, 'nav').find((n) => !closest(n, 'main')) || null,
  footer: qsa(root, 'footer').find((n) => !closest(n, 'main')) || null,
});

// ---------------------------------------------------------------- fixture dist from the live evidence
function buildFixture(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let indexChrome = '';
  const pages = site.pages.filter((p) => !p.isNew);
  for (const pg of pages) {
    const bp = builtPathOf(pg);
    const src = fs.readFileSync(path.join(EVID, pg.id, 'rendered.html'), 'utf8');
    const doc = parse(src);
    const root = qs(doc, '#root');
    const body = qs(doc, 'body');
    const edits = [];
    const { nav, footer } = liveChrome(root);
    if (!nav || !footer) throw new Error(`${pg.id}: live chrome not found`);
    edits.push({ start: nav.start, end: nav.start, text: '<header class="site-header">' }, { start: nav.end, end: nav.end, text: '</header>' });
    const ft = startTag(src, footer);
    const cm = /\sclass\s*=\s*"/i.exec(ft);
    edits.push(cm ? { start: footer.start + cm.index + cm[0].length, end: footer.start + cm.index + cm[0].length, text: 'site-footer ' } : { start: footer.start + 7, end: footer.start + 7, text: ' class="site-footer"' });
    for (const f of qsa(root, 'form')) edits.push({ start: f.start + 5, end: f.start + 5, text: ` data-api="${FORM_API[pg.id]}"` });
    for (const a of qsa(body, 'a[href]')) {
      const h = a.attrs.href.trim();
      if (/^\/(?!\/)/.test(h)) edits.push(attrEdit(src, a, 'href', relHref(h, bp)));
    }
    const main = qs(root, 'main');
    const injectAt = main ? main.end - '</main>'.length : footer.start;
    if (main && !src.slice(injectAt, main.end).startsWith('</main>')) throw new Error(`${pg.id}: </main> not where expected`);
    if (pg.id === 'contact') {
      const ex = readJSON(path.join(EVID, 'contact', 'expanded.json'));
      const lines = ex.clicks.flatMap((c) => c.appeared);
      edits.push({ start: injectAt, end: injectAt, text: `<section data-fixture="faq-answers">${lines.map((l) => `<p data-fixture-answer>${esc(l)}</p>`).join('')}</section>` });
    }
    if (pg.id === 'index') {
      const dm = readJSON(path.join(EVID, 'index', 'deal-modals.json'));
      edits.push({ start: injectAt, end: injectAt, text: `<div data-fixture="deal-modals">${dm.clicks.map((c, i) => `<div id="deal-${i}" data-fixture-deal>${c.dialog.html}</div>`).join('')}</div>` });
      const h1 = qs(root, 'h1');
      edits.push({ start: h1.start, end: h1.end, text: BUILT_H1 });
    }
    const out = applyEdits(src, edits.filter(Boolean));
    fs.mkdirSync(path.dirname(path.join(dir, bp)), { recursive: true });
    fs.writeFileSync(path.join(dir, bp), out);
    if (pg.id === 'index') {
      const d2 = parse(out);
      const r2 = qs(d2, '#root');
      indexChrome = { header: out.slice(qs(r2, 'header.site-header').start, qs(r2, 'header.site-header').end), footer: out.slice(qs(r2, 'footer.site-footer').start, qs(r2, 'footer.site-footer').end) };
    }
  }
  for (const pg of site.pages.filter((p) => p.isNew)) {
    const bp = builtPathOf(pg);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(pg.id)} | fixture</title><meta name="description" content="fixture description for ${esc(pg.id)}"><link rel="canonical" href="https://springfieldavedispensary.store/${esc(pg.path)}"></head><body><div id="root">${indexChrome.header}<main id="main"><h1>${esc(pg.id)}</h1></main>${indexChrome.footer}</div></body></html>`;
    fs.mkdirSync(path.dirname(path.join(dir, bp)), { recursive: true });
    fs.writeFileSync(path.join(dir, bp), html);
  }
  return pages.length;
}

// ---------------------------------------------------------------- runner
function runParity(dirAbs, name, extra = []) {
  const json = path.join(LAB, 'parity-reports', name + '.json');
  fs.mkdirSync(path.dirname(json), { recursive: true });
  fs.rmSync(json, { force: true });
  const r = spawnSync(process.execPath, [TOOL, ...(dirAbs ? ['--dir', dirAbs] : []), ...extra, '--json', json, '--quiet'], { encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || '');
  return { code: r.status, out, report: fs.existsSync(json) ? readJSON(json) : null, last: out.trim().split('\n').filter((l) => !l.startsWith('report:')).pop() || '' };
}
const fails = (rep, pageId) => (rep ? rep.pages.filter((p) => !pageId || p.id === pageId).flatMap((p) => p.fails.map((f) => ({ ...f, page: p.id }))) : []);
const has = (rep, pageId, code, pred = () => true) => fails(rep, pageId).some((f) => f.code === code && pred(f));
const readB = (d, bp) => fs.readFileSync(path.join(d, bp), 'utf8');
const writeB = (d, bp, s) => fs.writeFileSync(path.join(d, bp), s);
const bpOf = (id) => builtPathOf(site.pages.find((p) => p.id === id));
// occurrences of an exact string in a built page's body text (both lib-text variants)
function bodyCount(html, t, ci = false) {
  const b = qs(parse(html), 'body');
  let hay = textOf(b, { scope: b });
  if (ci) { hay = hay.toLowerCase(); t = t.toLowerCase(); }
  let n = 0; for (let i = hay.indexOf(t); i !== -1; i = hay.indexOf(t, i + 1)) n++;
  return n;
}
const editFile = (d, id, fn) => { const bp = bpOf(id); const s = readB(d, bp); const o = fn(s, parse(s)); if (o === s || o == null) throw new Error(`mutant on ${id} changed nothing`); writeB(d, bp, o); };

// ---------------------------------------------------------------- mutants on the fixture dist
// each mutate(dir) -> {expect: (report) => bool, detail} ; code defaults to 1
const pick = {};
const mutants = [
  { name: '(a) about: delete a live paragraph', mutate(d) {
      let target;
      editFile(d, 'about', (s, doc) => {
        const p = qsa(qs(doc, 'main'), 'p').find((n) => { const t = textOf(n, { scope: n }); return t.length > 40 && bodyCount(s, t) === 1; });
        target = textRuns(p, { scope: p, split: 'adjacent' });
        return s.slice(0, p.start) + s.slice(p.end);
      });
      pick.aboutParagraph = target;
      return { detail: target[0], expect: (r) => has(r, 'about', 'C1', (f) => target.includes(f.text)) };
    } },
  { name: '(b) shop-flower: change the <title>', mutate(d) {
      editFile(d, 'shop-flower', (s, doc) => { const t = qs(doc, 'title'); return s.slice(0, t.startTagEnd) + 'Cannabis Flower | Somewhere Else' + s.slice(t.end - '</title>'.length); });
      return { detail: 'title', expect: (r) => has(r, 'shop-flower', 'C3', (f) => f.field === 'title') };
    } },
  { name: '(c) index: drop the /shop?dtche[category]=flower link', mutate(d) {
      editFile(d, 'index', (s, doc) => applyEdits(s, qsa(doc, 'a[href]').filter((a) => a.attrs.href === './shop/?dtche[category]=flower').map((a) => attrEdit(s, a, 'href', null))));
      return { detail: '/shop?dtche[category]=flower', expect: (r) => has(r, 'index', 'C4', (f) => f.href === '/shop?dtche[category]=flower') };
    } },
  { name: '(d) delete blog-edibles-101-dosing built page', mutate(d) {
      fs.rmSync(path.join(d, bpOf('blog-edibles-101-dosing')));
      return { detail: bpOf('blog-edibles-101-dosing'), expect: (r) => has(r, 'blog-edibles-101-dosing', 'PAGE') && has(r, 'blog', 'C4', (f) => f.href === '/blog/edibles-101-dosing') };
    } },
  { name: '(e) contact: remove one FAQ answer', mutate(d) {
      let text;
      editFile(d, 'contact', (s, doc) => { const p = qsa(doc, 'p[data-fixture-answer]')[1]; text = norm(textOf(p, { scope: p })); return s.slice(0, p.start) + s.slice(p.end); });
      return { detail: text, expect: (r) => has(r, 'contact', 'C1', (f) => f.text === text && f.kind === 'expanded') };
    } },
  { name: '(f) about: lowercase one heading (CASE)', mutate(d) {
      let text;
      editFile(d, 'about', (s, doc) => {
        const h = qsa(qs(doc, 'main'), 'h1,h2,h3').find((n) => { const t = textOf(n, { scope: n }); return /\p{Lu}/u.test(t) && /\p{Ll}/u.test(t) && bodyCount(s, t) === 1 && textRuns(n, { scope: n, split: 'adjacent' }).length === 1; });
        text = textOf(h, { scope: h });
        return s.slice(0, h.startTagEnd) + esc(text.toLowerCase()) + s.slice(h.end - `</${h.tag}>`.length);
      });
      return { detail: text, expect: (r) => has(r, 'about', 'C1-CASE', (f) => f.text === text) };
    } },
  { name: '(g) loyalty: insert "Somerset" (forbidden)', mutate(d) {
      editFile(d, 'loyalty', (s, doc) => { const m = qs(doc, 'main'); return s.slice(0, m.startTagEnd) + '<p>Now open in Somerset</p>' + s.slice(m.startTagEnd); });
      return { detail: 'Somerset', expect: (r) => has(r, 'loyalty', 'FORBIDDEN', (f) => /somerset/i.test(f.text)) && r.forbidden.length > 0 };
    } },
  { name: '(h) index: remove one alt', mutate(d) {
      let alt;
      editFile(d, 'index', (s, doc) => {
        const all = qsa(qs(doc, 'body'), 'img[alt]').map((n) => n.attrs.alt).filter(Boolean);
        const img = qsa(qs(doc, 'main'), 'img[alt]').find((n) => n.attrs.alt && all.filter((a) => a === n.attrs.alt).length === 1);
        alt = img.attrs.alt;
        return applyEdits(s, [attrEdit(s, img, 'alt', null)]);
      });
      return { detail: alt, expect: (r) => has(r, 'index', 'C5', (f) => f.text === alt) };
    } },
  { name: "(i) careers: remove one 'What you'll do' line", mutate(d) {
      const ex = readJSON(path.join(EVID, 'careers', 'expanded.json'));
      let text;
      editFile(d, 'careers', (s, doc) => {
        const lines = ex.clicks.filter((c) => /WHAT YOU.LL DO/i.test(c.control)).flatMap((c) => c.appeared.map(norm));
        const li = qsa(doc, 'li').find((n) => { const t = norm(textOf(n, { scope: n })); return lines.includes(t) && bodyCount(s, t) === 1; });
        text = norm(textOf(li, { scope: li }));
        return s.slice(0, li.start) + s.slice(li.end);
      });
      return { detail: text, expect: (r) => has(r, 'careers', 'C1', (f) => f.text === text) };
    } },
  { name: '(j) about: footer heading removed (C2 chrome)', mutate(d) {
      let text;
      editFile(d, 'about', (s, doc) => {
        const f = qs(doc, 'footer.site-footer');
        // a footer text with no case-insensitive twin anywhere on the page, so the plain C2 rule (not C2-CASE) fires
        const h = qsa(f, 'h2,h3,h4,h5,p,span').find((n) => { const t = textOf(n, { scope: n }); return t.length > 3 && textRuns(n, { scope: n, split: 'adjacent' }).length === 1 && bodyCount(s, t, true) === 1; });
        text = textOf(h, { scope: h });
        return s.slice(0, h.start) + s.slice(h.end);
      });
      return { detail: text, expect: (r) => has(r, 'about', 'C2', (f) => f.text === text) };
    } },
  { name: '(k) contact: form without data-api (C6 endpoint)', mutate(d) {
      editFile(d, 'contact', (s, doc) => applyEdits(s, qsa(doc, 'form').map((f) => attrEdit(s, f, 'data-api', null))));
      return { detail: '/api/contact', expect: (r) => has(r, 'contact', 'C6', (f) => f.text === 'data-api') };
    } },
  { name: '(l) careers: form button text removed (C6 field)', mutate(d) {
      let text;
      editFile(d, 'careers', (s, doc) => {
        const b = qsa(qs(doc, 'form'), 'button').find((n) => { const t = textOf(n, { scope: n }); return t && bodyCount(s, t) === 1; });
        text = textOf(b, { scope: b });
        return s.slice(0, b.startTagEnd) + s.slice(b.end - '</button>'.length);
      });
      return { detail: text, expect: (r) => has(r, 'careers', 'C6', (f) => f.text === text) };
    } },
  { name: '(m) blog-live-rosin-science: JSON-LD value changed', mutate(d) {
      editFile(d, 'blog-live-rosin-science', (s, doc) => {
        const sc = qsa(doc, 'script').find((n) => (n.attrs.type || '') === 'application/ld+json');
        const j = JSON.parse(sc.raw); const k = Object.keys(j).find((x) => typeof j[x] === 'string' && !x.startsWith('@')); j[k] = j[k] + ' (edited)';
        return s.slice(0, sc.startTagEnd) + JSON.stringify(j) + s.slice(sc.end - '</script>'.length);
      });
      return { detail: 'ld', expect: (r) => has(r, 'blog-live-rosin-science', 'C3', (f) => /^ld\[/.test(f.field || '')) };
    } },
  { name: '(n) bundles: og:image changed', mutate(d) {
      editFile(d, 'bundles', (s, doc) => { const m = qsa(doc, 'meta').find((n) => n.attrs.property === 'og:image'); return applyEdits(s, [attrEdit(s, m, 'content', 'https://springfieldavedispensary.store/other.jpg')]); });
      return { detail: 'og:image', expect: (r) => has(r, 'bundles', 'C3', (f) => f.field === 'og:image') };
    } },
  { name: '(o) deals (new page): canonical removed', mutate(d) {
      editFile(d, 'deals', (s) => s.replace(/<link rel="canonical"[^>]*>/, ''));
      return { detail: 'canonical', expect: (r) => has(r, 'deals', 'NEW', (f) => f.field === 'canonical') };
    } },
  { name: '(o2) notfound: noindex page that names a canonical', mutate(d) {
      editFile(d, 'notfound', (s) => s.replace('<title>', '<meta name="robots" content="noindex"><title>'));
      return { detail: 'canonical', expect: (r) => has(r, 'notfound', 'NEW', (f) => f.field === 'canonical') };
    } },
  { name: '(p) index: query string not verbatim', mutate(d) {
      editFile(d, 'index', (s) => s.split('./shop/?dtche[category]=flower').join('./shop/?dtche%5Bcategory%5D=flower'));
      return { detail: '?dtche%5Bcategory%5D', expect: (r) => has(r, 'index', 'C4', (f) => f.href === '/shop?dtche[category]=flower') };
    } },
  { name: '(q) blog: root-absolute href does not resolve in dist', mutate(d) {
      editFile(d, 'blog', (s, doc) => applyEdits(s, qsa(doc, 'a[href]').filter((a) => a.attrs.href === '../contact/').map((a) => attrEdit(s, a, 'href', '/contact'))));
      return { detail: '/contact', expect: (r) => has(r, 'blog', 'C4', (f) => f.href === '/contact') };
    } },
  { name: '(r) loyalty: external href not verbatim', mutate(d) {
      editFile(d, 'loyalty', (s, doc) => applyEdits(s, qsa(qs(doc, '#root'), 'a[href]').filter((a) => a.attrs.href === 'https://dutchie.com').map((a) => attrEdit(s, a, 'href', 'https://dutchie.com/'))));
      return { detail: 'https://dutchie.com', expect: (r) => has(r, 'loyalty', 'C4', (f) => f.href === 'https://dutchie.com') };
    } },
  { name: '(s) index: alt retyped in caps (C5-CASE)', mutate(d) {
      let alt;
      editFile(d, 'index', (s, doc) => {
        const all = qsa(qs(doc, 'body'), 'img[alt]').map((n) => n.attrs.alt).filter(Boolean);
        const img = qsa(qs(doc, 'main'), 'img[alt]').filter((n) => n.attrs.alt && /\p{Ll}/u.test(n.attrs.alt) && all.filter((a) => a === n.attrs.alt).length === 1)[1];
        alt = img.attrs.alt;
        return applyEdits(s, [attrEdit(s, img, 'alt', alt.toUpperCase())]);
      });
      return { detail: alt, expect: (r) => has(r, 'index', 'C5-CASE', (f) => f.text === alt) };
    } },
  { name: '(t) removal declared => REMOVED, not failed (exit 0)', code: 0, mutate(d) {
      const m = mutants[0].mutate(d);
      const rf = path.join(LAB, 'parity-reports', 'removals-fixture.json');
      fs.mkdirSync(path.dirname(rf), { recursive: true });
      fs.writeFileSync(rf, JSON.stringify({ removals: pick.aboutParagraph.map((t) => ({ page: 'about', text: t, why: 'self-test: declared removal' })) }, null, 1));
      return { args: ['--removals', rf], detail: m.detail, expect: (r) => r.status === 'PASS' && r.totals.removed >= 1 && r.pages.find((p) => p.id === 'about').checks.C1.removed.some((x) => pick.aboutParagraph.includes(x.text)) };
    } },
  { name: '(u) removal without a why => FAIL', mutate(d) {
      const rf = path.join(LAB, 'parity-reports', 'removals-bad.json');
      fs.writeFileSync(rf, JSON.stringify({ removals: [{ page: 'about', text: 'anything', why: '' }] }));
      return { args: ['--removals', rf], detail: 'why', expect: (r) => r.problems.some((p) => /needs page, text \(or href\) and a non-empty why/.test(p)) };
    } },
  { name: '(v) dynamic status runs are not required (exit 0)', code: 0, mutate(d) {
      let n = 0;
      for (const pg of site.pages) {
        const bp = builtPathOf(pg); const s = readB(d, bp);
        const o = s.replace(/>Open Now</g, () => { n++; return '><'; }).replace(/>· Closes in [^<]*</g, () => { n++; return '><'; });
        writeB(d, bp, o);
      }
      if (!n) throw new Error('no status run found to remove');
      return { detail: `${n} status runs removed`, expect: (r) => r.status === 'PASS' };
    } },
  { name: '(w) empty dist dir => exit 2 (not a pass)', code: 2, mutate(d) {
      fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
      return { detail: 'empty', expect: (r) => r.status === 'NOT-READY' };
    } },
  { name: '(x) missing dist dir => exit 2', code: 2, mutate(d) {
      fs.rmSync(d, { recursive: true, force: true });
      return { detail: 'missing', expect: (r) => r.status === 'NOT-READY' };
    } },
];

// ---------------------------------------------------------------- join fixture (text-joining rule, one occurrence)
const JOIN = path.join(LAB, 'fixture-join');
function buildJoin(variant) {
  const ev = path.join(JOIN, variant, 'evidence', 'join');
  const dist = path.join(JOIN, variant, 'dist');
  fs.rmSync(path.join(JOIN, variant), { recursive: true, force: true });
  fs.mkdirSync(ev, { recursive: true }); fs.mkdirSync(path.join(dist, 'join'), { recursive: true });
  const head = '<title>Join fixture</title><meta name="description" content="Join fixture page"><link rel="canonical" href="https://springfieldavedispensary.store/join">';
  const zero = variant === 'zero-links';
  const link = zero ? '' : '<p><a href="/join">Visit</a></p>';
  fs.writeFileSync(path.join(ev, 'rendered.html'), `<!doctype html><html><head>${head}</head><body><div id="root"><nav>${zero ? '<span>Join</span>' : '<a href="/join">Join</a>'}</nav><main><h1 class="uppercase">Elevating<br><span class="text-white">Irvington, NJ</span></h1>${link}<img src="x.jpg" alt="Store front"></main><footer><p>Footer note</p></footer></div></body></html>`);
  fs.writeFileSync(path.join(ev, 'harvest.json'), JSON.stringify({ title: 'Join fixture', description: 'Join fixture page', canonical: 'https://springfieldavedispensary.store/join', og: {}, ld: [] }));
  fs.writeFileSync(path.join(JOIN, variant, 'site.json'), JSON.stringify({ pages: [{ id: 'join', path: 'join/', livePath: '/join', evidence: ['join'] }] }));
  const h1 = { clean: BUILT_H1, 'zero-links': BUILT_H1, 'comma-dropped': BUILT_H1.replace('</span>, NJ', '</span> NJ'), 'block-split': '<h1><div>Elevating</div><div>Irvington</div><div>, NJ</div></h1>' }[variant];
  fs.writeFileSync(path.join(dist, 'join', 'index.html'), `<!doctype html><html><head>${head}</head><body><header class="site-header"><nav><a href="./">Join</a></nav></header><main id="main">${h1}<p><a href="./">Visit</a></p><img src="x.jpg" alt="Store front"></main><footer class="site-footer"><p>Footer note</p></footer></body></html>`);
  return ['--dir', dist, '--site', path.join(JOIN, variant, 'site.json'), '--evidence', path.join(JOIN, variant, 'evidence'), '--chrome', 'join'];
}
const joinCases = [
  { name: 'join: built inline-span h1 carries live "Irvington, NJ"', variant: 'clean', code: 0, expect: (r) => r.status === 'PASS' && r.totals.runsCompared > 0 },
  { name: 'join: comma dropped => FAIL', variant: 'comma-dropped', code: 1, expect: (r) => has(r, 'join', 'C1', (f) => f.text === 'Irvington, NJ') },
  { name: 'join: halves in block elements => FAIL', variant: 'block-split', code: 1, expect: (r) => has(r, 'join', 'C1', (f) => f.text === 'Irvington, NJ') },
  { name: 'join: live page with 0 content links => FAIL (ZERO)', variant: 'zero-links', code: 1, expect: (r) => has(r, 'join', 'ZERO', (f) => /C4 compared 0/.test(f.msg)) },
];

// ---------------------------------------------------------------- run
const t0 = Date.now();
const nPages = buildFixture(FIX);
console.log(`fixture: ${nPages} live pages + ${site.pages.length - nPages} new pages written to ${path.relative(P, FIX)}`);
const clean = runParity(FIX, 'clean');
const t = clean.report && clean.report.totals;
const cleanOk = clean.code === 0 && clean.report && clean.report.status === 'PASS' && t.pages === site.pages.length && t.runsCompared > 0 && t.linksCompared > 0 && t.headCompared > 0 && t.altsCompared > 0 && t.formItemsCompared > 0;
console.log(`clean: exit ${clean.code} :: ${clean.last}`);
if (!cleanOk) console.log(clean.out.split('\n').slice(0, 80).join('\n'));
const results = [];
let caught = 0; let total = 0;
for (const m of mutants) {
  total++;
  fs.rmSync(MUT, { recursive: true, force: true });
  fs.cpSync(FIX, MUT, { recursive: true });
  let spec; let r; let found = false; let err = null;
  try { spec = m.mutate(MUT); r = runParity(MUT, 'mut-' + m.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''), spec.args || []); found = !!(r.report && spec.expect(r.report)); } catch (e) { err = e.message; }
  const want = m.code ?? 1;
  const ok = !err && r && r.code === want && found;
  if (ok) caught++;
  results.push({ name: m.name, detail: spec && spec.detail, exit: r && r.code, wantExit: want, findingPresent: found, caught: ok, error: err, last: r && r.last });
  console.log(`${ok ? 'CAUGHT ' : 'MISSED '} ${m.name.padEnd(56)} exit ${r ? r.code : '-'} (want ${want}) ${err ? 'ERROR ' + err : 'finding ' + (found ? 'present' : 'ABSENT')}${spec && spec.detail ? ' :: ' + JSON.stringify(String(spec.detail).slice(0, 70)) : ''}`);
  if (!ok && r) console.log('   ' + r.last);
}
let joinCleanOk = false;
for (const jc of joinCases) {
  total++;
  let r; let found = false; let err = null;
  try { r = runParity(null, 'join-' + jc.variant, buildJoin(jc.variant)); found = !!(r.report && jc.expect(r.report)); } catch (e) { err = e.message; }
  const ok = !err && r && r.code === jc.code && found;
  if (jc.variant === 'clean') joinCleanOk = ok;
  if (ok) caught++;
  results.push({ name: jc.name, exit: r && r.code, wantExit: jc.code, findingPresent: found, caught: ok, error: err, last: r && r.last });
  console.log(`${ok ? 'CAUGHT ' : 'MISSED '} ${jc.name.padEnd(56)} exit ${r ? r.code : '-'} (want ${jc.code}) ${err ? 'ERROR ' + err : 'finding ' + (found ? 'present' : 'ABSENT')}`);
  if (!ok && r) console.log('   ' + r.last + '\n' + r.out.split('\n').filter((l) => /^\s+(C\d|ZERO|PAGE)/.test(l)).slice(0, 8).join('\n'));
}
if (!KEEP) fs.rmSync(MUT, { recursive: true, force: true });
const nMut = total - 1; const nCaught = caught - (joinCleanOk ? 1 : 0);
const pass = cleanOk && joinCleanOk && caught === total;
fs.writeFileSync(path.join(LAB, 'parity-selftest.json'), JSON.stringify({ tool: 'parity-selftest', at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), clean: { exit: clean.code, status: clean.report && clean.report.status, totals: t, last: clean.last }, joinClean: joinCleanOk, results, mutantsCaught: nCaught, mutants: nMut, status: pass ? 'PASS' : 'FAIL' }, null, 1));
console.log(`SELFTEST parity: ${nCaught}/${nMut} mutants caught, clean ${cleanOk && joinCleanOk ? 'PASS' : 'FAIL'} (fixture-dist ${cleanOk ? 'PASS' : 'FAIL'}, join fixture ${joinCleanOk ? 'PASS' : 'FAIL'}) in ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(pass ? 0 : 1);
