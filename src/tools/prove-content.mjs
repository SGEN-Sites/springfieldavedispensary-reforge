#!/usr/bin/env node
// prove-content.mjs — "every string the build shows was on the live Springfield site, or is declared".
//
// Usage:
//   node src/tools/prove-content.mjs [--content <dir>] [--site <site.json>] [--evidence <audit/pages>]
//                                    [--scan <dir>]... [--json <report.json>] [--quiet]
//   env PROVE_CONTENT_ROOT=<dir> is the same as --content <dir>. Relative paths resolve against the project root P.
//   Defaults: --content P/src/content  --site P/src/content/site.json  --evidence P/audit/pages
//             --scan P/src/content P/src/pages P/src/lib P/src/scripts P/src/styles P/dist (any --scan REPLACES the list;
//             with --content and no --scan, the content root is added to the default list instead of P/src/content)
//             --json P/audit/prove-content.json
//   Exit: 0 PASS · 1 FAIL (any unproved / CASE / accent / forbidden / bad label / unmapped file, or 0 strings checked)
//         2 not ready (the content root or <content>/pages does not exist)
//
// What is checked
//   Content files: <content>/shared.json (proves against the union of every live page), <content>/pages/**/*.json
//   (file name = page id from site.json, or a root key "_pages": ["shop-flower", ...] for a template shared by several
//   pages; a page's evidence slugs come from site.json "evidence"), and the `alt` leaves of <content>/images.json
//   (shipped alt text, union of every live page).
//   Every string leaf is proved except under the keys href src srcset img image imageKey key id slug path template
//   class variant kind tone layout icon day dayIndex category dutchieSlug api source and any key starting with "_"
//   (a skip key skips string values only; an object under a skip key is still walked). Keys ending in Href, Url, Src,
//   Srcset, Path, Slug, Key, Id, Ids or Api (camelCase, e.g. directionsHref, heroSrc) are skipped too, but ONLY when
//   the value holds no whitespace (a URL / path / id); prose under such a key is still proved. Counted as
//   totals.skippedBySuffix and listed in the JSON report (files[].suffixSkipped).
//   Evidence corpus of a page id (DOM tier = the live DOM's own case):
//     DOM tier:   textOf of rendered.html <body> (inline joined without a space, one space at block boundaries) and
//                 its 'adjacent' variant (a space between touching inline elements: live flex rows);
//                 alt / aria-label / placeholder / title / value attributes;
//                 harvest.json title / description / og:* / twitter:*; the age-gate dialog text (audit/pages/_gate);
//                 index: the text of each deal dialog's captured HTML (deal-modals.json clicks[].dialog.html)
//     innerText tier (CSS may have uppercased it): expanded.json clicks[].appeared + fullText; deal-modals.json
//                 clicks[].appeared + dialog.text
//   Verdicts per string (normalised: NFC, whitespace collapsed). "Occurs" = exact substring whose alphanumeric edges
//   do not touch another letter/digit (lib-text match), so "Y" is not proved by "Yes" nor "20" by "200+":
//     PROVED   occurs in the DOM tier, or in the innerText tier when the DOM tier holds no other-case copy
//     DECLARED exact text of a label in <content>/ui-labels.json {"labels":[{"text","why"}]} (why must be non-empty)
//     CASE     only a case-insensitive match exists (FAIL: carry DOM case, uppercase with CSS)
//     UNPROVED anything else (FAIL); via "fragment" when it only occurs inside a longer word/number
//   Typography forms:
//     {"text":"…","accent":"…"}  text is proved, accent must be a substring of text (FAIL "accent")
//     sibling keys {"title":…, "titleAccent":"…"} (any <k> + <k>Accent): the accent leaf is proved like any string
//       AND must be a substring of <k>'s text (parts joined with one space) (FAIL "accent"; also when <k> is absent)
//     parts arrays — an array of strings / {text,accent} objects under a key named parts, *Parts, title, heading,
//       headline, h1, h2, h3, display, lede, tagline, kicker or eyebrow: every part AND the parts joined with one
//       space must prove. Arrays under any other key are lists: each item proves on its own.
//   FORBIDDEN (sister store): /Central Jersey|Somerset|\bcjd\b|centraljerseydispensary|hero-cjd|cjd-logo/i in the text
//   or the path of any file under the scan roots -> FAIL with file:line:col.
//
// Self-test: node src/tools/prove-content-selftest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, qsa, qs, textOf, norm, attrs, match } from './lib-text.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = path.resolve(HERE, '..', '..');
export const FORBIDDEN = /Central Jersey|Somerset|\bcjd\b|centraljerseydispensary|hero-cjd|cjd-logo/i;
const SKIP_KEYS = new Set(['href', 'src', 'srcset', 'img', 'image', 'imageKey', 'key', 'id', 'slug', 'path', 'template', 'class', 'variant', 'kind', 'tone', 'layout', 'icon', 'day', 'dayIndex', 'category', 'dutchieSlug', 'api', 'source']);
// camelCase / snake suffixes that always hold a URL, path, id or key (e.g. directionsHref, heroSrc, menuUrl)
const SKIP_SUFFIX = /(Href|Hrefs|Url|Urls|URL|Src|Srcset|Path|Slug|Key|Id|Ids|Api|_href|_url|_src|_path|_id)$/;
const isSkipKey = (k) => typeof k === 'string' && (SKIP_KEYS.has(k) || k.startsWith('_'));
const isSuffixKey = (k) => typeof k === 'string' && SKIP_SUFFIX.test(k);
const PARTS_KEYS = new Set(['parts', 'title', 'heading', 'headline', 'h1', 'h2', 'h3', 'display', 'lede', 'tagline', 'kicker', 'eyebrow']);
const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|eot|mp4|webm|mov|pdf|zip|gz|br)$/i;

function args(argv) {
  const o = { scan: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    if (a === '--content') o.content = v();
    else if (a === '--site') o.site = v();
    else if (a === '--evidence') o.evidence = v();
    else if (a === '--scan') o.scan.push(v());
    else if (a === '--json') o.json = v();
    else if (a === '--quiet') o.quiet = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else { console.error('unknown argument: ' + a); process.exit(2); }
  }
  return o;
}
const abs = (p) => (path.isAbsolute(p) ? p : path.resolve(P, p));
const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const rel = (f) => path.relative(P, f) || '.';

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const st = fs.statSync(dir);
  if (st.isFile()) { out.push(dir); return out; }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(f, out); else if (e.isFile()) out.push(f);
  }
  return out;
}

export function forbiddenScan(roots) {
  const hits = [];
  let files = 0;
  const g = new RegExp(FORBIDDEN.source, 'gi');
  for (const r of roots) {
    for (const f of walkFiles(r)) {
      files++;
      const rp = rel(f);
      const pm = rp.match(FORBIDDEN);
      if (pm) hits.push({ file: rp, line: 0, col: 0, match: pm[0], where: 'path' });
      if (BINARY.test(f)) continue;
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((ln, i) => { g.lastIndex = 0; let m; while ((m = g.exec(ln))) hits.push({ file: rp, line: i + 1, col: m.index + 1, match: m[0], context: ln.slice(Math.max(0, m.index - 40), m.index + 60).trim() }); });
    }
  }
  return { files, hits };
}

// ---------------------------------------------------------------- evidence corpus
function corpusFor(slug, evidenceDir, gateText) {
  const dir = path.join(evidenceDir, slug);
  const dom = []; const inner = [];
  const rf = path.join(dir, 'rendered.html');
  if (!fs.existsSync(rf)) return null;
  const doc = parse(fs.readFileSync(rf, 'utf8'));
  dom.push(textOf(doc, { root: 'body' }), textOf(doc, { root: 'body', split: 'adjacent' }));
  const body = qs(doc, 'body') || doc;
  for (const a of ['alt', 'aria-label', 'placeholder', 'title', 'value']) for (const v of attrs(body, '*', a)) if (norm(v)) dom.push(norm(v));
  const hv = path.join(dir, 'harvest.json');
  if (fs.existsSync(hv)) {
    const h = readJSON(hv);
    for (const v of [h.title, h.description, ...Object.values(h.og || {})]) if (v) dom.push(norm(v));
  }
  if (gateText) dom.push(gateText);
  const ex = path.join(dir, 'expanded.json');
  if (fs.existsSync(ex)) {
    const e = readJSON(ex);
    for (const c of e.clicks || []) for (const a of c.appeared || []) inner.push(norm(a));
    for (const t of e.fullText || []) inner.push(norm(t));
  }
  const dm = path.join(dir, 'deal-modals.json');
  if (fs.existsSync(dm)) {
    const d = readJSON(dm);
    for (const c of d.clicks || []) {
      for (const a of c.appeared || []) inner.push(norm(a));
      if (c.dialog && c.dialog.text) { inner.push(norm(c.dialog.text)); for (const l of String(c.dialog.text).split('\n')) if (norm(l)) inner.push(norm(l)); }
      if (c.dialog && c.dialog.html) { const dd = parse(c.dialog.html); dom.push(textOf(dd, { root: 'body' }), textOf(dd, { root: 'body', split: 'adjacent' })); }
    }
  }
  return { dom, inner };
}
function makeCorpus(parts) {
  const dom = parts.flatMap((p) => p.dom).filter(Boolean).join('\n');
  const inner = parts.flatMap((p) => p.inner).filter(Boolean).join('\n');
  return { dom, inner, domL: dom.toLowerCase(), innerL: inner.toLowerCase(), size: dom.length + inner.length };
}

export function classify(s, corpus, labels) {
  const md = match(s, { text: corpus.dom, lower: corpus.domL });
  if (md === 'ok') return { verdict: 'PROVED', via: 'dom' };
  if (labels.has(s)) return { verdict: 'DECLARED' };
  const mi = match(s, { text: corpus.inner, lower: corpus.innerL });
  if (mi === 'ok') {
    if (md === 'case') return { verdict: 'CASE', via: 'innerText-only (CSS case); the live DOM has it in another case' };
    return { verdict: 'PROVED', via: 'innerText' };
  }
  if (md === 'case' || mi === 'case') return { verdict: 'CASE', via: md === 'case' ? 'dom' : 'innerText' };
  if (md === 'fragment' || mi === 'fragment') return { verdict: 'UNPROVED', via: 'fragment: occurs only inside a longer word/number' };
  return { verdict: 'UNPROVED' };
}

// ---------------------------------------------------------------- content walk
const isAccentObj = (v) => v && typeof v === 'object' && !Array.isArray(v) && typeof v.text === 'string' &&
  Object.keys(v).every((k) => k === 'text' || k === 'accent' || isSkipKey(k)) && (v.accent === undefined || typeof v.accent === 'string');
const isPartsKey = (k) => typeof k === 'string' && (PARTS_KEYS.has(k) || /Parts$/.test(k));
const jp = (base, k) => (typeof k === 'number' ? `${base}[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `${base}.${k}` : `${base}[${JSON.stringify(k)}]`);

export function collectStrings(json, opts = {}) {
  const out = []; // {path, text, kind}
  const errors = []; // {path, kind, msg}
  const suffixSkipped = []; // {path, text}: URL/id-like values under a *Href/*Url/*Src/... key
  const only = opts.onlyKeys ? new Set(opts.onlyKeys) : null;
  const leaf = (p, key, s, kind = 'string') => {
    if (only && !only.has(key)) return;
    out.push({ path: p, text: s, kind });
  };
  const accent = (p, key, o) => {
    leaf(jp(p, 'text'), key, o.text, 'text');
    if (o.accent !== undefined && !(only && !only.has(key))) {
      if (!norm(o.accent) || !norm(o.text).includes(norm(o.accent))) errors.push({ path: jp(p, 'accent'), kind: 'accent', text: o.accent, msg: `accent "${o.accent}" is not a substring of text "${o.text}"` });
    }
  };
  const walk = (v, p, key) => {
    if (typeof v === 'string') {
      if (isSkipKey(key)) return;
      if (isSuffixKey(key) && !/\s/.test(v.trim())) { suffixSkipped.push({ path: p, text: v }); return; }
      leaf(p, key, v);
      return;
    }
    if (Array.isArray(v)) {
      const skipKey = isSkipKey(key);
      if (!skipKey && isPartsKey(key) && v.length > 1 && v.every((x) => typeof x === 'string' || isAccentObj(x))) {
        v.forEach((x, i) => (typeof x === 'string' ? leaf(jp(p, i), key, x, 'part') : accent(jp(p, i), key, x)));
        const joined = v.map((x) => (typeof x === 'string' ? x : x.text)).map(norm).filter(Boolean).join(' ');
        leaf(p, key, joined, 'joined');
        return;
      }
      v.forEach((x, i) => walk(x, jp(p, i), key));
      return;
    }
    if (v && typeof v === 'object') {
      if (isAccentObj(v) && !(isSkipKey(key))) { accent(p, key, v); return; }
      for (const [k, x] of Object.entries(v)) {
        if (k.startsWith('_')) continue;
        walk(x, jp(p, k), k);
        const am = /^(.+)Accent$/.exec(k);
        if (am && typeof x === 'string' && !isSkipKey(k) && !(only && !only.has(k))) {
          const base = v[am[1]];
          const baseText = typeof base === 'string' ? norm(base)
            : Array.isArray(base) ? base.map((b) => (typeof b === 'string' ? b : b && typeof b.text === 'string' ? b.text : '')).map(norm).filter(Boolean).join(' ')
              : isAccentObj(base) ? norm(base.text) : null;
          if (baseText == null) errors.push({ path: jp(p, k), kind: 'accent', text: x, msg: `${k} "${x}" has no sibling "${am[1]}" to accent` });
          else if (!norm(x) || !baseText.includes(norm(x))) errors.push({ path: jp(p, k), kind: 'accent', text: x, msg: `${k} "${x}" is not a substring of ${am[1]} "${baseText}"` });
        }
      }
    }
  };
  walk(json, '$', null);
  return { strings: out, errors, suffixSkipped };
}

// ---------------------------------------------------------------- main
export function run(o) {
  const contentRoot = abs(o.content || process.env.PROVE_CONTENT_ROOT || 'src/content');
  const sitePath = abs(o.site || 'src/content/site.json');
  const evidenceDir = abs(o.evidence || 'audit/pages');
  const report = { tool: 'prove-content', at: new Date().toISOString(), contentRoot: rel(contentRoot), site: rel(sitePath), evidence: rel(evidenceDir), status: 'FAIL', files: [], forbidden: null, labels: null, problems: [], warnings: [], totals: {} };
  if (!fs.existsSync(contentRoot) || !fs.existsSync(path.join(contentRoot, 'pages'))) {
    report.status = 'NOT-READY';
    report.problems.push(`${rel(path.join(contentRoot, 'pages'))} does not exist yet: nothing to prove (this is not a PASS)`);
    return { report, code: 2 };
  }
  const site = readJSON(sitePath);
  const pages = site.pages || [];
  const byId = new Map(pages.map((p) => [p.id, p]));
  // gate text (the 21+ dialog renders on every live page before it is dismissed)
  let gateText = '';
  const gf = path.join(evidenceDir, '_gate', 'gate.html');
  if (fs.existsSync(gf)) {
    const gd = parse(fs.readFileSync(gf, 'utf8'));
    const dlg = qsa(gd, '[role=dialog],[role=alertdialog],dialog');
    gateText = dlg.map((n) => textOf(n, { scope: n }) + '\n' + textOf(n, { scope: n, split: 'adjacent' })).join('\n');
  } else report.warnings.push('no audit/pages/_gate/gate.html: age-gate copy can only be DECLARED');
  const slugCache = new Map();
  const slugCorpus = (slug) => { if (!slugCache.has(slug)) slugCache.set(slug, corpusFor(slug, evidenceDir, gateText)); return slugCache.get(slug); };
  const livePages = pages.filter((p) => !p.isNew);
  const missingEvidence = new Set();
  const corpusOfPages = (ids) => {
    const parts = [];
    for (const id of ids) {
      const pg = byId.get(id);
      for (const slug of (pg && pg.evidence) || []) { const c = slugCorpus(slug); if (c) parts.push(c); else missingEvidence.add(slug); }
    }
    return makeCorpus(parts);
  };
  const unionCorpus = corpusOfPages(livePages.map((p) => p.id));

  // labels
  const labelsFile = path.join(contentRoot, 'ui-labels.json');
  const labels = new Map();
  const labelInfo = { file: rel(labelsFile), count: 0, used: 0, unused: [], invalid: [] };
  if (fs.existsSync(labelsFile)) {
    let lj;
    try { lj = readJSON(labelsFile); } catch (e) { report.problems.push(`ui-labels.json is not valid JSON: ${e.message}`); lj = { labels: [] }; }
    for (const [i, l] of (lj.labels || []).entries()) {
      if (!l || typeof l.text !== 'string' || !norm(l.text) || typeof l.why !== 'string' || !norm(l.why)) { labelInfo.invalid.push({ index: i, label: l }); continue; }
      labels.set(norm(l.text), { why: l.why, used: 0 });
      if (/\$\s?\d|\d\s?%|\b\d{2,}\b/.test(l.text)) report.warnings.push(`ui-labels.json label "${l.text}" contains a number/price/percent: labels may not carry claims, prices or stats`);
    }
    labelInfo.count = labels.size;
  } else report.warnings.push(`${rel(labelsFile)} not found: nothing is DECLARED`);
  // lane declarations: <content>/ui-labels.d/<lane>.json (same shape, same validation), merged into the same set
  const labelsDir = path.join(contentRoot, 'ui-labels.d');
  labelInfo.laneFiles = [];
  if (fs.existsSync(labelsDir)) for (const f of fs.readdirSync(labelsDir).filter((x) => x.endsWith('.json')).sort()) {
    let lj;
    try { lj = readJSON(path.join(labelsDir, f)); } catch (e) { report.problems.push(`ui-labels.d/${f} is not valid JSON: ${e.message}`); continue; }
    labelInfo.laneFiles.push(f);
    for (const [i, l] of (lj.labels || []).entries()) {
      if (!l || typeof l.text !== 'string' || !norm(l.text) || typeof l.why !== 'string' || !norm(l.why)) { labelInfo.invalid.push({ index: `${f}#${i}`, label: l }); continue; }
      if (!labels.has(norm(l.text))) labels.set(norm(l.text), { why: l.why, used: 0 });
      if (/\$\s?\d|\d\s?%|\b\d{2,}\b/.test(l.text)) report.warnings.push(`ui-labels.d/${f} label "${l.text}" contains a number/price/percent: labels may not carry claims, prices or stats`);
    }
    labelInfo.count = labels.size;
  }
  const labelSet = { has: (s) => { const l = labels.get(s); if (l) { l.used++; return true; } return false; } };

  // content files
  const fileJobs = [];
  const sharedF = path.join(contentRoot, 'shared.json');
  if (fs.existsSync(sharedF)) fileJobs.push({ file: sharedF, pages: ['*'], corpus: unionCorpus });
  else report.problems.push(`${rel(sharedF)} is missing (BUILD-CONTRACT §1: chrome copy lives there)`);
  const pageFiles = walkFiles(path.join(contentRoot, 'pages')).filter((f) => f.endsWith('.json')).sort();
  for (const f of pageFiles) {
    let j;
    try { j = readJSON(f); } catch (e) { report.problems.push(`${rel(f)}: invalid JSON (${e.message})`); continue; }
    const id = path.basename(f, '.json');
    let ids = Array.isArray(j && j._pages) ? j._pages : byId.has(id) ? [id] : null;
    if (!ids || !ids.length) { report.problems.push(`${rel(f)}: maps to no page (file name "${id}" is not a site.json id and there is no "_pages")`); continue; }
    const unknown = ids.filter((x) => !byId.has(x));
    if (unknown.length) { report.problems.push(`${rel(f)}: "_pages" names unknown page id(s) ${unknown.join(', ')}`); ids = ids.filter((x) => byId.has(x)); if (!ids.length) continue; }
    fileJobs.push({ file: f, pages: ids, corpus: corpusOfPages(ids), json: j });
  }
  const imagesF = path.join(contentRoot, 'images.json');
  if (fs.existsSync(imagesF)) fileJobs.push({ file: imagesF, pages: ['*'], corpus: unionCorpus, onlyKeys: ['alt'] });
  for (const s of missingEvidence) report.problems.push(`evidence slug "${s}" has no ${rel(path.join(evidenceDir, s, 'rendered.html'))}`);

  let checked = 0;
  const totals = { proved: 0, declared: 0, case: 0, unproved: 0, accent: 0, empty: 0, skippedBySuffix: 0 };
  for (const job of fileJobs) {
    const json = job.json || (() => { try { return readJSON(job.file); } catch (e) { report.problems.push(`${rel(job.file)}: invalid JSON (${e.message})`); return null; } })();
    if (json == null) continue;
    const { strings, errors, suffixSkipped } = collectStrings(json, { onlyKeys: job.onlyKeys });
    const fr = { file: rel(job.file), pages: job.pages, corpusChars: job.corpus.size, counts: { checked: 0, proved: 0, declared: 0, case: 0, unproved: 0, accent: errors.length, empty: 0 }, unproved: [], case: [], accent: errors, declared: [], suffixSkipped };
    if (job.pages[0] !== '*' && job.corpus.size === 0) fr.note = 'no live evidence for these page(s): every string must be DECLARED';
    for (const s of strings) {
      const t = norm(s.text);
      if (!t) { fr.counts.empty++; continue; }
      fr.counts.checked++;
      const c = classify(t, job.corpus, labelSet);
      if (c.verdict === 'PROVED') fr.counts.proved++;
      else if (c.verdict === 'DECLARED') { fr.counts.declared++; fr.declared.push({ path: s.path, text: t }); }
      else if (c.verdict === 'CASE') { fr.counts.case++; fr.case.push({ path: s.path, text: t, kind: s.kind, via: c.via }); }
      else { fr.counts.unproved++; fr.unproved.push({ path: s.path, text: t, kind: s.kind, ...(c.via ? { via: c.via } : {}) }); }
    }
    checked += fr.counts.checked;
    totals.skippedBySuffix += suffixSkipped.length;
    for (const k of Object.keys(totals)) totals[k] += fr.counts[k] || 0;
    report.files.push(fr);
  }
  for (const [t, l] of labels) if (!l.used) labelInfo.unused.push(t);
  labelInfo.used = labels.size - labelInfo.unused.length;
  if (labelInfo.invalid.length) report.problems.push(`ui-labels.json: ${labelInfo.invalid.length} label(s) without a non-empty text and why`);
  if (labelInfo.unused.length) report.warnings.push(`ui-labels.json: ${labelInfo.unused.length} declared label(s) used by no content string`);
  report.labels = labelInfo;

  const scanRoots = o.scan && o.scan.length ? o.scan.map(abs) : [contentRoot, ...['src/pages', 'src/lib', 'src/scripts', 'src/styles', 'dist'].map(abs)];
  const fz = forbiddenScan([...new Set(scanRoots)]);
  report.forbidden = { roots: [...new Set(scanRoots)].map(rel), filesScanned: fz.files, hits: fz.hits };
  if (fz.files === 0) report.warnings.push('forbidden scan: 0 files under the scan roots');

  totals.checked = checked;
  totals.files = report.files.length;
  totals.forbidden = fz.hits.length;
  report.totals = totals;
  const fail = checked === 0 || totals.unproved || totals.case || totals.accent || fz.hits.length || report.problems.length;
  if (checked === 0) report.problems.push('0 strings were checked: a comparison of nothing is not a pass');
  report.status = fail ? 'FAIL' : 'PASS';
  return { report, code: fail ? 1 : 0 };
}

function print(report, quiet) {
  const L = [];
  L.push(`prove-content  content=${report.contentRoot}  evidence=${report.evidence}`);
  if (report.status === 'NOT-READY') { L.push('NOT READY: ' + report.problems.join('; ')); console.log(L.join('\n')); return; }
  L.push('file'.padEnd(46) + 'checked  proved  declared  CASE  unproved  accent');
  for (const f of report.files) {
    const c = f.counts;
    L.push(f.file.padEnd(46) + String(c.checked).padStart(7) + String(c.proved).padStart(8) + String(c.declared).padStart(10) + String(c.case).padStart(6) + String(c.unproved).padStart(10) + String(c.accent).padStart(8));
  }
  if (!quiet) {
    for (const f of report.files) {
      for (const u of f.unproved) L.push(`  UNPROVED ${f.file} ${u.path}${u.kind !== 'string' ? ' (' + u.kind + ')' : ''}: ${JSON.stringify(u.text)}${u.via ? ' (' + u.via + ')' : ''}`);
      for (const u of f.case) L.push(`  CASE     ${f.file} ${u.path}: ${JSON.stringify(u.text)} (${u.via})`);
      for (const u of f.accent) L.push(`  ACCENT   ${f.file} ${u.path}: ${u.msg}`);
    }
    for (const h of report.forbidden.hits) L.push(`  FORBIDDEN ${h.file}:${h.line}:${h.col} "${h.match}"${h.where === 'path' ? ' (in the file path)' : ''}`);
  }
  for (const p of report.problems) L.push('  PROBLEM  ' + p);
  for (const w of report.warnings) L.push('  warn     ' + w);
  const t = report.totals;
  L.push(`${report.status}  prove-content: ${t.checked} strings checked in ${t.files} files: ${t.proved} proved, ${t.declared} declared, ${t.case} CASE, ${t.unproved} unproved, ${t.accent} accent errors; forbidden ${t.forbidden} hit(s) in ${report.forbidden.filesScanned} files`);
  console.log(L.join('\n'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const o = args(process.argv);
  if (o.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }
  let res;
  try { res = run(o); } catch (e) { console.error('FAIL prove-content crashed: ' + (e && e.stack || e)); process.exitCode = 1; }
  if (res) {
  const out = abs(o.json || 'audit/prove-content.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(res.report, null, 2));
  print(res.report, o.quiet);
  console.log('report: ' + rel(out));
  process.exitCode = res.code;
  }
}
