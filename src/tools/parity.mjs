#!/usr/bin/env node
// parity.mjs — "every live thing survived into the build". No browser; reads the live evidence and the built HTML.
//
// Usage:
//   node src/tools/parity.mjs [--dir dist] [--page <id>] [--json audit/parity.json]
//                             [--removals src/content/removals.json] [--site src/content/site.json]
//                             [--evidence audit/pages] [--chrome index] [--quiet]
//   --chrome <id>: the live page whose header/footer runs C2 requires on every built page (default index).
//   Relative paths resolve against the project root P. Exit: 0 PASS · 1 FAIL · 2 not ready (no dist/, no .html in
//   dist/, or an unknown --page id).
//
// For every site.json page with a live id (not isNew): live = <evidence>/<id>/rendered.html, built =
// <dir>/<page.path>index.html ('' -> index.html, '404.html' -> 404.html). Checks, each reporting how many items it
// compared (a live page whose check compared 0 items FAILS — a comparison of nothing is not a pass; C6 is n/a on a
// page with no live form):
//   Text model (lib-text "Text joining"): built text = inline elements joined WITHOUT a space, one space only at block
//   boundaries (so <span class="accent">Irvington</span>, NJ reads "Irvington, NJ"), plus the variant with a space
//   between touching inline elements (flex rows). Live runs use split 'adjacent' (the live React DOM lays touching
//   inline siblings out as flex items). "Occurs" = exact substring whose alphanumeric edges do not touch another
//   letter/digit; a run found only inside a longer word/number ("7g" in "17g", "Y" in "Yes") is a miss.
//   C1 text   every live text run inside #root, except the live chrome (the <header>, or the first <nav> outside
//             <main> since the live site has no <header>; the <footer>; [role=dialog]#age-gate) and dynamic runs
//             (Open Now, Closed, "· …", Closes in…, Open until…, Opens…, TODAY/Today, "1 / 5"), must occur in the built
//             <body> text (exact case; a case-only match is CASE = FAIL and the message quotes what the build has).
//             Repeats are reported, one occurrence is enough. Plus the extra evidence: contact + careers expanded.json "appeared" lines,
//             index deal-modals.json "appeared" lines. Page-specific live chrome runs that the index chrome does not
//             have are added here too. A run met only inside the built chrome is a warning (chromeOnly).
//   C2 chrome the index page's live header runs must be in every built page's header.site-header / #drawer /
//             nav.dock text, its live footer runs in footer.site-footer (dynamic status runs excluded).
//   C3 head   title, meta description, canonical, every og:* and twitter:* value equal to harvest.json (the live
//             RENDERED head); every live JSON-LD block deep-equal (parsed) to a built JSON-LD block.
//   C4 links  every live internal target (path + query + hash: /shop?dtche[category]=flower, /about, #apply) must be
//             reached by a built <a href> that, resolved against the built page's URL inside dist/, lands on the
//             built file for that path (live /x -> x/index.html) with the query verbatim, the file exists, and a
//             #fragment has a matching id. Root-absolute hrefs ("/about") do not resolve inside dist/ (contract:
//             every link relative). Every live external href (maps, mailto:, https://…) must appear verbatim as a
//             built href. href="#" (dead live social icons, F7) and javascript: are not targets.
//   C5 alts   every non-empty live <img> alt must be an alt on the built page (case-only = CASE).
//   C6 forms  every live form label / placeholder / aria-label / option / button text must be on the built page,
//             and a built form must carry data-api = the live endpoint (index -> /api/newsletter/subscribe,
//             contact -> /api/contact, careers -> /api/careers/apply). n/a on pages without a live form.
//   FORBIDDEN /Central Jersey|Somerset|\bcjd\b|centraljerseydispensary|hero-cjd|cjd-logo/i in any file text or path
//             under the dist dir (only the page's file with --page).
//   New pages (isNew: deals, notfound): built file exists with a non-empty title, meta description and canonical;
//   C2 runs on them as a warning only.
// Declared removals: <removals> {"removals":[{"page":"<id>|*","text":"…","why":"…"}]} (or "href" instead of text for
// a link target). A failing item whose text equals a removal's text — or whose enclosing element's text equals it —
// is reported REMOVED (with why) and not failed. Every removal needs a non-empty why.
// Self-test: node src/tools/parity-selftest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, qs, qsa, closest, compileSelector, textRunNodes, textOf, flowText, norm, alts, headFields, match as matchText, caseSnippet } from './lib-text.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = path.resolve(HERE, '..', '..');
export const FORBIDDEN = /Central Jersey|Somerset|\bcjd\b|centraljerseydispensary|hero-cjd|cjd-logo/i;
export const FORM_API = { index: '/api/newsletter/subscribe', contact: '/api/contact', careers: '/api/careers/apply' };
const DYNAMIC = [/^Open Now$/i, /^Closed$/i, /^Closed Now$/i, /^· /, /^Closes in /i, /^Open until/i, /^Opens /i, /^Today$/i, /^\d+\s*\/\s*\d+$/];
const LIVE_HOSTS = new Set(['springfieldavedispensary.store', 'www.springfieldavedispensary.store', 'springfieldavedispensary.com', 'www.springfieldavedispensary.com']);
const LIVE_ORIGIN = 'https://springfieldavedispensary.store';
const BUILT_HEADER = 'header.site-header, #drawer, nav.dock';
const BUILT_FOOTER = 'footer.site-footer';
const BUILT_CHROME = 'header.site-header, footer.site-footer, #drawer, nav.dock, #age-gate';
const BASE = 'https://dist.invalid/__d__/';
const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|eot|mp4|webm|mov|pdf|zip|gz|br)$/i;
export const isDynamic = (t) => DYNAMIC.some((r) => r.test(t));

function args(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    if (a === '--dir') o.dir = v();
    else if (a === '--page') o.page = v();
    else if (a === '--json') o.json = v();
    else if (a === '--removals') o.removals = v();
    else if (a === '--site') o.site = v();
    else if (a === '--evidence') o.evidence = v();
    else if (a === '--chrome') o.chrome = v();
    else if (a === '--quiet') o.quiet = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else { console.error('unknown argument: ' + a); process.exit(2); }
  }
  return o;
}
const abs = (p) => (path.isAbsolute(p) ? p : path.resolve(P, p));
const rel = (f) => path.relative(P, f) || '.';
const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
export const builtPathOf = (page) => (page.path === '' ? 'index.html' : page.path.endsWith('/') ? page.path + 'index.html' : page.path);
function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(f, out); else if (e.isFile()) out.push(f);
  }
  return out;
}
function splitHref(raw) {
  const hi = raw.indexOf('#');
  const pre = hi >= 0 ? raw.slice(0, hi) : raw;
  const qi = pre.indexOf('?');
  return { search: qi >= 0 ? pre.slice(qi) : '', hash: hi >= 0 ? raw.slice(hi) : '' };
}
export function livePathToBuilt(pathname) {
  let p = pathname.replace(/^\/+/, '');
  try { p = decodeURIComponent(p); } catch { /* keep raw */ }
  if (p === '') return 'index.html';
  if (/\.html?$/i.test(p)) return p;
  return p.replace(/\/+$/, '') + '/index.html';
}
function liveTarget(href, ownBuilt, livePath) {
  if (!href || href === '#') return { skip: 'href="#" or empty' };
  if (/^javascript:/i.test(href)) return { skip: 'javascript:' };
  if (href.startsWith('#')) return { internal: true, file: ownBuilt, search: '', hash: href };
  if (/^(mailto|tel|sms):/i.test(href)) return { external: true };
  let u;
  try { u = new URL(href, LIVE_ORIGIN + (livePath || '/')); } catch { return { external: true } }
  if (/^https?:$/.test(u.protocol) && LIVE_HOSTS.has(u.hostname)) {
    const { search, hash } = splitHref(href.replace(/^https?:\/\/[^/?#]+/i, ''));
    return { internal: true, file: livePathToBuilt(u.pathname), search, hash };
  }
  return { external: true };
}
export function resolveBuilt(href, fromFile) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return { external: true };
  let u;
  try { u = new URL(href, BASE + fromFile); } catch { return { invalid: true } }
  if (!u.pathname.startsWith('/__d__/')) return { escapes: true, pathname: u.pathname };
  let f = u.pathname.slice('/__d__/'.length);
  try { f = decodeURIComponent(f); } catch { /* keep */ }
  if (f === '' || f.endsWith('/')) f += 'index.html';
  const { search, hash } = splitHref(href);
  return { file: f, search, hash };
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a); const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}
const hasLower = (s) => /\p{Ll}/u.test(s);

// ---------------------------------------------------------------- models
function liveModel(dir, id) {
  const f = path.join(dir, id, 'rendered.html');
  if (!fs.existsSync(f)) return null;
  const doc = parse(fs.readFileSync(f, 'utf8'));
  const root = qs(doc, '#root') || qs(doc, 'body') || doc;
  const header = qs(root, 'header') || qsa(root, 'nav').find((n) => !closest(n, 'main')) || null;
  const footer = qsa(root, 'footer').find((n) => !closest(n, 'main')) || null;
  const gate = compileSelector('[role=dialog]#age-gate, #age-gate');
  const exclude = (n) => n === header || n === footer || gate(n);
  // 'adjacent': the live React DOM lays touching inline siblings out as flex items (see lib-text "Text joining")
  const runsMain = textRunNodes(root, { scope: root, exclude, split: 'adjacent' });
  const headerRuns = header ? textRunNodes(header, { scope: header, split: 'adjacent' }).map((r) => r.text) : [];
  const footerRuns = footer ? textRunNodes(footer, { scope: footer, split: 'adjacent' }).map((r) => r.text) : [];
  const hv = path.join(dir, id, 'harvest.json');
  return { doc, root, header, footer, runsMain, headerRuns, footerRuns, harvest: fs.existsSync(hv) ? readJSON(hv) : null };
}
function builtModel(file) {
  const html = fs.readFileSync(file, 'utf8');
  const doc = parse(html);
  const body = qs(doc, 'body') || doc;
  const hay = (scopeNodes, ex) => {
    const parts = [];
    // textOf = inline joined without a space (the lead's rule); the 'adjacent' variant adds a space between touching
    // inline elements so a flex row like <span>Y</span><span>You</span> still matches "Y" at a word boundary.
    for (const n of scopeNodes) parts.push(textOf(n, { scope: n, exclude: ex }), textOf(n, { scope: n, exclude: ex, split: 'adjacent' }));
    const text = parts.join('\n');
    return { text, lower: text.toLowerCase(), nodes: scopeNodes.length };
  };
  const attrVals = [];
  for (const n of qsa(body, '*')) for (const a of ['alt', 'aria-label', 'placeholder', 'title', 'value']) if (n.attrs[a] != null && norm(n.attrs[a])) attrVals.push(norm(n.attrs[a]));
  const attrText = attrVals.join('\n');
  return {
    html, doc, body,
    all: hay([body]),
    content: hay([body], BUILT_CHROME),
    header: hay(qsa(body, BUILT_HEADER)),
    footer: hay(qsa(body, BUILT_FOOTER)),
    attrs: { text: attrText, lower: attrText.toLowerCase() },
    alts: alts(body, { scope: body }),
    anchors: qsa(body, 'a[href],area[href]').map((n) => n.attrs.href.trim()),
    ids: new Set(qsa(doc, '[id]').map((n) => n.attrs.id)),
    forms: qsa(body, 'form').map((n) => ({ api: n.attrs['data-api'] ?? null, optionValues: qsa(n, 'option').map((o) => o.attrs.value ?? flowText(o, { scope: o })) })),
    head: headFields(doc),
  };
}
// 'ok' | 'case' | 'fragment' | 'missing' (lib-text match: exact + word-boundary aligned). A fragment (the run only
// occurs inside a longer word or number, e.g. "7g" inside "17g") is a miss.
const match = (t, hay) => matchText(t, hay);
const isBad = (m) => m !== 'ok';
const why = (m, t, hay) => {
  if (m === 'case') return `only matches case-insensitively (built has ${JSON.stringify(caseSnippet(t, hay))}; carry DOM case, uppercase with CSS)`;
  if (m === 'fragment') return `occurs only inside a longer word/number (built has ${JSON.stringify(caseSnippet(t, hay, 3))})`;
  return 'is missing';
};

// ---------------------------------------------------------------- removals
function loadRemovals(file, problems) {
  const list = [];
  // the main file plus lane files in a sibling removals.d/ folder (same shape, same validation)
  const dir = path.join(path.dirname(file), 'removals.d');
  const files = [file, ...(fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort().map((x) => path.join(dir, x)) : [])];
  let present = false;
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    present = true;
    let j;
    try { j = readJSON(f); } catch (e) { problems.push(`${rel(f)}: invalid JSON (${e.message})`); continue; }
    for (const [i, r] of (j.removals || []).entries()) {
      const text = r && typeof r.text === 'string' ? norm(r.text) : '';
      const href = r && typeof r.href === 'string' ? r.href.trim() : '';
      if (!r || typeof r.page !== 'string' || !r.page || (!text && !href) || typeof r.why !== 'string' || !norm(r.why)) { problems.push(`${rel(f)}: removal #${i} needs page, text (or href) and a non-empty why`); continue; }
      list.push({ page: r.page, text, href, why: r.why, used: 0, from: rel(f) });
    }
  }
  return { list, file: rel(file), present };
}
function findRemoval(removals, pageId, candidates) {
  for (const r of removals.list) {
    if (r.page !== '*' && r.page !== pageId) continue;
    for (const c of candidates) if (c && ((r.text && r.text === c) || (r.href && r.href === c))) { r.used++; return r; }
  }
  return null;
}
function ancestorTexts(nodes, stopAt) {
  const out = new Set();
  for (const tn of nodes) for (let p = tn.parent; p && p !== stopAt && p.type === 'el'; p = p.parent) out.add(flowText(p, { scope: p }));
  return [...out];
}

// ---------------------------------------------------------------- main
export function run(o) {
  const dist = abs(o.dir || 'dist');
  const sitePath = abs(o.site || 'src/content/site.json');
  const evidence = abs(o.evidence || 'audit/pages');
  const removalsPath = abs(o.removals || 'src/content/removals.json');
  const report = { tool: 'parity', at: new Date().toISOString(), dist: rel(dist), evidence: rel(evidence), removals: null, status: 'FAIL', pages: [], forbidden: [], problems: [], warnings: [], totals: {} };
  if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) { report.status = 'NOT-READY'; report.problems.push(`${rel(dist)} does not exist: build first (node src/tools/build.mjs); this is not a PASS`); return { report, code: 2 }; }
  const distFiles = walkFiles(dist);
  if (!distFiles.some((f) => f.endsWith('.html'))) { report.status = 'NOT-READY'; report.problems.push(`${rel(dist)} holds no .html file: build first; this is not a PASS`); return { report, code: 2 }; }
  const site = readJSON(sitePath);
  let pages = site.pages || [];
  if (o.page) {
    pages = pages.filter((p) => p.id === o.page);
    if (!pages.length) { report.status = 'NOT-READY'; report.problems.push(`--page ${o.page}: no such page id in ${rel(sitePath)}`); return { report, code: 2 }; }
  }
  const removals = loadRemovals(removalsPath, report.problems);
  const chromeId = o.chrome || 'index';
  const index = liveModel(evidence, chromeId);
  if (!index) report.problems.push(`no live ${chromeId} evidence (${rel(path.join(evidence, chromeId, 'rendered.html'))}): C2 cannot compare`);
  const uniq = (a) => [...new Set(a)];
  const chromeHeader = index ? uniq(index.headerRuns.filter((t) => !isDynamic(t))) : [];
  const chromeFooter = index ? uniq(index.footerRuns.filter((t) => !isDynamic(t))) : [];
  const builtCache = new Map();
  const getBuilt = (f) => { if (!builtCache.has(f)) builtCache.set(f, fs.existsSync(path.join(dist, f)) ? builtModel(path.join(dist, f)) : null); return builtCache.get(f); };

  for (const page of pages) {
    const bp = builtPathOf(page);
    const pr = { id: page.id, isNew: !!page.isNew, built: bp, status: 'PASS', fails: [], checks: {}, warnings: [] };
    report.pages.push(pr);
    const fail = (code, msg, extra = {}) => pr.fails.push({ code, msg, ...extra });
    const B = getBuilt(bp);
    if (!B) { fail('PAGE', `built page ${rel(path.join(dist, bp))} is missing`); pr.status = 'FAIL'; continue; }

    const chrome = (warnOnly) => {
      const c = { compared: 0, missing: [], case: [], removed: [] };
      if (!B.header.nodes) (warnOnly ? pr.warnings.push('no header.site-header') : fail('C2', 'built page has no header.site-header / #drawer / nav.dock'));
      if (!B.footer.nodes) (warnOnly ? pr.warnings.push('no footer.site-footer') : fail('C2', 'built page has no footer.site-footer'));
      for (const [where, runs, hay] of [['header', chromeHeader, B.header], ['footer', chromeFooter, B.footer]]) {
        for (const t of runs) {
          c.compared++;
          const m = match(t, hay);
          if (m === 'ok') continue;
          const r = findRemoval(removals, page.id, [t]);
          if (r) { c.removed.push({ where, text: t, why: r.why }); continue; }
          (m === 'case' ? c.case : c.missing).push({ where, text: t });
          if (!warnOnly) fail(m === 'case' ? 'C2-CASE' : 'C2', `live ${where} run ${JSON.stringify(t)} ${why(m, t, hay)} in the built ${where}`, { text: t });
          else pr.warnings.push(`chrome ${where} ${m}: ${JSON.stringify(t)}`);
        }
      }
      if (!warnOnly && c.compared === 0) fail('ZERO', 'C2 compared 0 chrome runs');
      return c;
    };

    if (page.isNew) {
      const h = B.head; let n = 0;
      // a noindex page (the 404) must NOT name a canonical; every other new page needs one
      const robots = (B.html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i) || [])[1] || '';
      const noindex = /noindex/i.test(robots);
      for (const [k, v] of [['title', h.title], ['description', h.description], ['canonical', h.canonical]]) {
        n++;
        if (k === 'canonical' && noindex) { if (v) fail('NEW', 'noindex page names a canonical', { field: k }); continue; }
        if (!v) fail('NEW', `new page has no ${k}`, { field: k });
      }
      pr.checks.NEW = { compared: n };
      pr.checks.C2 = chrome(true);
    } else {
      const L = liveModel(evidence, page.id);
      if (!L) { fail('LIVE', `no live evidence ${rel(path.join(evidence, page.id, 'rendered.html'))}`); pr.status = 'FAIL'; continue; }

      // ---- C1 text
      const c1 = { compared: 0, runs: 0, extra: 0, ok: 0, missing: [], case: [], removed: [], repeats: 0, dynamicSkipped: 0, chromeOnly: [], capsInnerText: 0 };
      const byText = new Map();
      for (const r of L.runsMain) {
        if (isDynamic(r.text)) { c1.dynamicSkipped++; continue; }
        if (!byText.has(r.text)) byText.set(r.text, { text: r.text, nodes: [], kind: 'run' }); else c1.repeats++;
        byText.get(r.text).nodes.push(...r.nodes);
      }
      for (const t of uniq([...L.headerRuns, ...L.footerRuns])) {
        if (isDynamic(t) || chromeHeader.includes(t) || chromeFooter.includes(t) || byText.has(t)) continue;
        byText.set(t, { text: t, nodes: [], kind: 'chrome-local' });
      }
      const extraFile = page.id === 'index' ? 'deal-modals.json' : (page.id === 'contact' || page.id === 'careers') ? 'expanded.json' : null;
      if (extraFile) {
        const ef = path.join(evidence, page.id, extraFile);
        let lines = [];
        if (fs.existsSync(ef)) {
          for (const c of readJSON(ef).clicks || []) for (const a of c.appeared || []) if (norm(a)) lines.push(norm(a));
        } else fail('ZERO', `extra evidence ${rel(ef)} is missing`);
        lines = uniq(lines);
        if (!lines.length) fail('ZERO', `extra evidence ${extraFile} gave 0 lines`);
        for (const t of lines) { if (!byText.has(t)) byText.set(t, { text: t, nodes: [], kind: extraFile === 'deal-modals.json' ? 'deal-modal' : 'expanded' }); c1.extra++; }
      }
      for (const item of byText.values()) {
        c1.compared++;
        if (item.kind === 'run') c1.runs++;
        const m = match(item.text, B.all);
        if (m === 'ok') {
          c1.ok++;
          if (item.kind !== 'chrome-local' && match(item.text, B.content) !== 'ok') c1.chromeOnly.push(item.text);
          continue;
        }
        if (m === 'case' && item.kind !== 'run' && item.kind !== 'chrome-local' && !hasLower(item.text)) { c1.ok++; c1.capsInnerText++; continue; }
        const r = findRemoval(removals, page.id, [item.text, ...ancestorTexts(item.nodes, L.root)]);
        if (r) { c1.removed.push({ text: item.text, kind: item.kind, why: r.why }); continue; }
        (m === 'case' ? c1.case : c1.missing).push({ text: item.text, kind: item.kind });
        fail(m === 'case' ? 'C1-CASE' : 'C1', `${item.kind} ${JSON.stringify(item.text)} ${m === 'missing' ? 'is missing from the built page' : why(m, item.text, B.all)}`, { text: item.text, kind: item.kind });
      }
      if (c1.runs === 0) fail('ZERO', 'C1 compared 0 live text runs');
      if (c1.chromeOnly.length) pr.warnings.push(`${c1.chromeOnly.length} live content run(s) found only inside the built chrome`);
      pr.checks.C1 = c1;

      // ---- C2 chrome
      pr.checks.C2 = chrome(false);

      // ---- C3 head
      const c3 = { compared: 0, fails: [] };
      const hv = L.harvest;
      if (!hv) fail('ZERO', 'no harvest.json: C3 compared 0 fields');
      else {
        const bh = B.head;
        const cmp = (field, live, built) => { c3.compared++; if (norm(live) !== norm(built ?? '')) { c3.fails.push({ field, live, built }); fail('C3', `${field}: built ${JSON.stringify(built)} != live ${JSON.stringify(live)}`, { field }); } };
        cmp('title', hv.title, bh.title);
        cmp('description', hv.description, bh.description);
        cmp('canonical', hv.canonical, bh.canonical);
        for (const [k, v] of Object.entries(hv.og || {})) cmp(k, v, bh.og[k]);
        for (const [k, vs] of Object.entries(bh.ogAll || {})) if (vs.length > 1) pr.warnings.push(`built head has ${vs.length} ${k} tags`);
        const builtLd = [];
        for (const raw of bh.ld) { try { const j = JSON.parse(raw); builtLd.push(j); if (Array.isArray(j)) builtLd.push(...j); if (j && Array.isArray(j['@graph'])) builtLd.push(...j['@graph']); } catch { pr.warnings.push('built JSON-LD block does not parse'); } }
        for (const [i, raw] of (hv.ld || []).entries()) {
          c3.compared++;
          let lj; try { lj = JSON.parse(raw); } catch { pr.warnings.push(`live JSON-LD #${i} does not parse`); continue; }
          if (!builtLd.some((b) => deepEqual(b, lj))) { c3.fails.push({ field: `ld[${i}]`, live: lj['@type'] }); fail('C3', `live JSON-LD #${i} (${lj['@type']}) has no deep-equal block in the built page`, { field: `ld[${i}]` }); }
        }
        if (c3.compared === 0) fail('ZERO', 'C3 compared 0 head fields');
      }
      pr.checks.C3 = c3;

      // ---- C4 links
      const c4 = { compared: 0, internal: 0, external: 0, skipped: 0, fails: [], removed: [] };
      const liveLinks = qsa(L.root, 'a[href],area[href]').map((n) => n.attrs.href.trim());
      const builtRes = B.anchors.map((h) => ({ href: h, r: resolveBuilt(h, bp) }));
      const seen = new Set();
      for (const href of liveLinks) {
        const t = liveTarget(href, bp, page.livePath);
        if (t.skip) { c4.skipped++; continue; }
        const key = t.internal ? `i:${t.file}${t.search}${t.hash}` : `e:${href}`;
        if (seen.has(key)) continue;
        seen.add(key);
        c4.compared++;
        let problem = null;
        if (t.internal) {
          c4.internal++;
          const lands = builtRes.some(({ r }) => r.file === t.file && r.search === t.search && (t.hash === '' || r.hash === t.hash));
          if (!lands) problem = `no built <a> lands on ${t.file}${t.search}${t.hash} (live href ${href})`;
          else if (!fs.existsSync(path.join(dist, t.file))) problem = `link target ${t.file} (live ${href}) does not exist in dist`;
          else if (t.hash.length > 1) {
            const tb = getBuilt(t.file);
            let id = t.hash.slice(1); try { id = decodeURIComponent(id); } catch { /* keep */ }
            if (!tb || !tb.ids.has(id)) problem = `${t.file} has no element id="${id}" for ${href}`;
          }
        } else {
          c4.external++;
          if (!B.anchors.includes(href)) problem = `external href ${href} is not on the built page verbatim`;
        }
        if (problem) {
          const r = findRemoval(removals, page.id, [href]);
          if (r) c4.removed.push({ href, why: r.why });
          else { c4.fails.push({ href, problem }); fail('C4', problem, { href }); }
        }
      }
      const rootAbs = B.anchors.filter((h) => /^\/(?!\/)/.test(h));
      if (rootAbs.length) pr.warnings.push(`${rootAbs.length} root-absolute href(s) (contract: every link relative), e.g. ${rootAbs[0]}`);
      if (c4.compared === 0) fail('ZERO', 'C4 compared 0 live links');
      pr.checks.C4 = c4;

      // ---- C5 alts
      const c5 = { compared: 0, missing: [], case: [], removed: [] };
      const builtAlts = new Set(B.alts);
      const builtAltsL = new Set(B.alts.map((a) => a.toLowerCase()));
      for (const a of uniq(alts(L.root, { scope: L.root }).filter(Boolean))) {
        c5.compared++;
        if (builtAlts.has(a)) continue;
        const r = findRemoval(removals, page.id, [a]);
        if (r) { c5.removed.push({ text: a, why: r.why }); continue; }
        if (builtAltsL.has(a.toLowerCase())) { c5.case.push(a); fail('C5-CASE', `alt ${JSON.stringify(a)} only matches case-insensitively`, { text: a }); }
        else { c5.missing.push(a); fail('C5', `alt ${JSON.stringify(a)} is not an alt on the built page`, { text: a }); }
      }
      if (c5.compared === 0) fail('ZERO', 'C5 compared 0 live alts');
      pr.checks.C5 = c5;

      // ---- C6 forms
      const liveForms = qsa(L.root, 'form');
      const c6 = { compared: 0, forms: liveForms.length, endpoint: FORM_API[page.id] || null, missing: [], case: [], removed: [], status: liveForms.length ? 'checked' : 'n/a' };
      if (liveForms.length) {
        const items = [];
        const add = (kind, t) => { t = norm(t); if (t) items.push({ kind, text: t }); };
        const liveOptionValues = [];
        for (const f of liveForms) {
          for (const n of qsa(f, 'label')) add('label', flowText(n, { scope: n }));
          for (const n of qsa(f, 'input[placeholder],textarea[placeholder]')) add('placeholder', n.attrs.placeholder);
          for (const n of qsa(f, 'input[aria-label],select[aria-label],textarea[aria-label],button[aria-label]')) add('aria-label', n.attrs['aria-label']);
          for (const n of qsa(f, 'option')) { add('option', flowText(n, { scope: n })); if (n.attrs.value) liveOptionValues.push(n.attrs.value); }
          for (const n of qsa(f, 'button')) add('button', flowText(n, { scope: n }) || n.attrs['aria-label'] || '');
          for (const n of qsa(f, 'input[type=submit],input[type=button]')) add('button', n.attrs.value || '');
        }
        const seenI = new Set();
        for (const it of items) {
          const k = it.kind + '\u0000' + it.text;
          if (seenI.has(k)) continue;
          seenI.add(k);
          c6.compared++;
          const m1 = match(it.text, B.all); const m2 = match(it.text, B.attrs);
          if (m1 === 'ok' || m2 === 'ok') continue;
          const r = findRemoval(removals, page.id, [it.text]);
          if (r) { c6.removed.push({ ...it, why: r.why }); continue; }
          const isCase = m1 === 'case' || m2 === 'case';
          (isCase ? c6.case : c6.missing).push(it);
          fail(isCase ? 'C6-CASE' : 'C6', `form ${it.kind} ${JSON.stringify(it.text)} ${isCase ? 'only matches case-insensitively' : 'is not on the built page'}`, { text: it.text });
        }
        c6.compared++;
        c6.endpointOk = !!c6.endpoint && B.forms.some((f) => f.api === c6.endpoint);
        if (!c6.endpoint) fail('C6', `page has ${liveForms.length} live form(s) but no known endpoint`);
        else if (!c6.endpointOk) fail('C6', `no built form carries data-api="${c6.endpoint}" (built forms: ${JSON.stringify(B.forms.map((f) => f.api))})`, { text: 'data-api' });
        const builtValues = new Set(B.forms.flatMap((f) => f.optionValues));
        const missV = uniq(liveOptionValues).filter((v) => !builtValues.has(v));
        if (missV.length) pr.warnings.push(`live <option> value(s) not used by a built option (payload drift?): ${missV.join(', ')}`);
      }
      pr.checks.C6 = c6;
    }
  }

  // ---- forbidden
  const scanFiles = o.page ? pages.map((p) => path.join(dist, builtPathOf(p))).filter((f) => fs.existsSync(f)) : distFiles;
  const g = new RegExp(FORBIDDEN.source, 'gi');
  for (const f of scanFiles) {
    const rp = path.relative(dist, f).split(path.sep).join('/');
    const owner = report.pages.find((p) => p.built === rp);
    const hit = (h) => { report.forbidden.push(h); if (owner) { owner.fails.push({ code: 'FORBIDDEN', msg: `${h.file}:${h.line}:${h.col} "${h.match}"`, text: h.match }); } };
    const pm = rp.match(FORBIDDEN);
    if (pm) hit({ file: rel(f), line: 0, col: 0, match: pm[0], where: 'path' });
    if (BINARY.test(f)) continue;
    fs.readFileSync(f, 'utf8').split('\n').forEach((ln, i) => { g.lastIndex = 0; let m; while ((m = g.exec(ln))) hit({ file: rel(f), line: i + 1, col: m.index + 1, match: m[0] }); });
  }

  for (const pr of report.pages) pr.status = pr.fails.length ? 'FAIL' : 'PASS';
  report.removals = { file: removals.file, present: removals.present, count: removals.list.length, unused: removals.list.filter((r) => !r.used).map((r) => ({ page: r.page, text: r.text || r.href })) };
  if (report.removals.unused.length) report.warnings.push(`${report.removals.unused.length} declared removal(s) matched nothing`);
  const t = { pages: report.pages.length, pagesFailed: report.pages.filter((p) => p.status === 'FAIL').length, runsCompared: 0, runsMissing: 0, runsCase: 0, removed: 0, linksCompared: 0, headCompared: 0, altsCompared: 0, formItemsCompared: 0, forbidden: report.forbidden.length };
  for (const p of report.pages) {
    const c = p.checks;
    if (c.C1) { t.runsCompared += c.C1.compared; t.runsMissing += c.C1.missing.length; t.runsCase += c.C1.case.length; t.removed += c.C1.removed.length; }
    for (const k of ['C2', 'C5', 'C6']) if (c[k] && c[k].removed) t.removed += c[k].removed.length;
    if (c.C4) { t.linksCompared += c.C4.compared; t.removed += c.C4.removed.length; }
    if (c.C3) t.headCompared += c.C3.compared;
    if (c.C5) t.altsCompared += c.C5.compared;
    if (c.C6) t.formItemsCompared += c.C6.compared;
  }
  report.totals = t;
  const failed = t.pagesFailed > 0 || report.forbidden.length > 0 || report.problems.length > 0 || t.pages === 0;
  if (t.pages === 0) report.problems.push('0 pages compared');
  report.status = failed ? 'FAIL' : 'PASS';
  return { report, code: failed ? 1 : 0 };
}

function print(report, quiet) {
  const L = [];
  L.push(`parity  dist=${report.dist}  evidence=${report.evidence}  removals=${report.removals ? report.removals.file + (report.removals.present ? ` (${report.removals.count})` : ' (absent)') : '-'}`);
  if (report.status === 'NOT-READY') { L.push('NOT READY: ' + report.problems.join('; ')); console.log(L.join('\n')); return; }
  L.push('page'.padEnd(30) + 'runs cmp/miss/case/rem'.padEnd(24) + 'chrome'.padEnd(10) + 'head'.padEnd(8) + 'links'.padEnd(9) + 'alts'.padEnd(8) + 'forms'.padEnd(9) + 'status');
  const frac = (c, bad) => (c ? `${c.compared - bad}/${c.compared}` : '-');
  for (const p of report.pages) {
    const c = p.checks;
    const runs = c.C1 ? `${c.C1.compared}/${c.C1.missing.length}/${c.C1.case.length}/${c.C1.removed.length}` : p.isNew ? 'new page' : '-';
    const chrome = c.C2 ? frac(c.C2, c.C2.missing.length + c.C2.case.length) : '-';
    const head = c.C3 ? frac(c.C3, c.C3.fails.length) : c.NEW ? `${c.NEW.compared - p.fails.filter((f) => f.code === 'NEW').length}/${c.NEW.compared}` : '-';
    const links = c.C4 ? frac(c.C4, c.C4.fails.length) : '-';
    const altsS = c.C5 ? frac(c.C5, c.C5.missing.length + c.C5.case.length) : '-';
    const forms = c.C6 ? (c.C6.status === 'n/a' ? 'n/a' : `${c.C6.compared - c.C6.missing.length - c.C6.case.length - (c.C6.endpointOk ? 0 : 1)}/${c.C6.compared}`) : '-';
    L.push(p.id.padEnd(30) + runs.padEnd(24) + chrome.padEnd(10) + head.padEnd(8) + links.padEnd(9) + altsS.padEnd(8) + forms.padEnd(9) + p.status + (p.fails.length ? ` (${[...new Set(p.fails.map((f) => f.code))].join(',')})` : ''));
  }
  if (!quiet) {
    for (const p of report.pages) for (const f of p.fails) L.push(`  ${f.code.padEnd(9)} ${p.id}: ${f.msg}`);
    for (const p of report.pages) for (const w of p.warnings) L.push(`  warn      ${p.id}: ${w}`);
    for (const p of report.pages) for (const k of ['C1', 'C2', 'C4', 'C5', 'C6']) for (const r of (p.checks[k] && p.checks[k].removed) || []) L.push(`  REMOVED   ${p.id} ${k}: ${JSON.stringify(r.text || r.href)} — ${r.why}`);
  }
  for (const h of report.forbidden) if (!report.pages.some((p) => p.built && h.file.endsWith(p.built))) L.push(`  FORBIDDEN ${h.file}:${h.line}:${h.col} "${h.match}"`);
  for (const p of report.problems) L.push('  PROBLEM   ' + p);
  for (const w of report.warnings) L.push('  warn      ' + w);
  const t = report.totals;
  L.push(`${report.status}  parity: ${t.pages} pages (${t.pagesFailed} failed); text runs ${t.runsCompared} compared, ${t.runsMissing} missing, ${t.runsCase} CASE; ${t.removed} REMOVED; links ${t.linksCompared}; head fields ${t.headCompared}; alts ${t.altsCompared}; form items ${t.formItemsCompared}; forbidden ${t.forbidden}`);
  console.log(L.join('\n'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const o = args(process.argv);
  if (o.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }
  let res;
  try { res = run(o); } catch (e) { console.error('FAIL parity crashed: ' + (e && e.stack || e)); process.exitCode = 1; }
  if (res) {
    const out = abs(o.json || 'audit/parity.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(res.report, null, 2));
    print(res.report, o.quiet);
    console.log('report: ' + rel(out));
    process.exitCode = res.code;
  }
}
