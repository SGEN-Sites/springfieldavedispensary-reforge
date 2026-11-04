#!/usr/bin/env node
// prove-content-selftest.mjs — proves that prove-content.mjs PASSES a clean content set and FAILS each broken one.
//
// Usage:  node src/tools/prove-content-selftest.mjs [--keep]
//   Builds a fixture content root under audit/labs/t1/fixture-content/clean/ (shared.json, pages/*.json incl. a
//   "_pages" template, images.json, ui-labels.json) from strings that are on the live Springfield evidence, runs
//   prove-content on it as a child process (--content <fixture> --scan <fixture>, real site.json + audit/pages) and
//   expects exit 0 / PASS with a non-zero count. Then, one at a time on a copy, it applies each mutant and expects
//   exit 1 (or 2 where stated) AND the specific finding in the JSON report (path / text / kind) — a FAIL for some
//   other reason does not count as caught. Mutant copies are deleted afterwards unless --keep.
//   Report: audit/labs/t1/prove-content-selftest.json. Exit 0 only when the clean run passes and every mutant is
//   caught. Node 18+ builtins only; no browser.
//   Output ends with: "SELFTEST prove-content: N/N mutants caught, clean PASS"

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

setTimeout(() => { console.error('SELFTEST prove-content: watchdog timeout (10 min)'); process.exit(3); }, 10 * 60 * 1000).unref();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = path.resolve(HERE, '..', '..');
const TOOL = path.join(HERE, 'prove-content.mjs');
const LAB = path.join(P, 'audit', 'labs', 't1', 'fixture-content');
const KEEP = process.argv.includes('--keep');
const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJSON = (f, j) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(j, null, 1) + '\n'); };

// ---------------------------------------------------------------- clean fixture (every string is on the live site)
const faq = readJSON(path.join(P, 'audit/pages/contact/expanded.json')).clicks[0];
const deal = readJSON(path.join(P, 'audit/pages/index/deal-modals.json')).clicks[0];
const clean = {
  'shared.json': {
    _note: 'T1 self-test fixture (not the real content)',
    nav: [{ text: 'Home', href: './' }, { text: 'About', href: 'about/' }, { text: 'Blog', href: 'blog/' }],
    shopNow: 'Shop Now',
    pause: 'Pause motion',
    directionsHref: 'https://www.google.com/maps/dir/?api=1&destination=1070%20Springfield%20Ave',
    address: '1070 Springfield Ave Suite C, Irvington NJ',
    href: 'https://invented.example/not-on-the-live-site', // skip key: never proved
  },
  'pages/index.json': {
    hero: { h1: ['Elevating', { text: 'Irvington, NJ', accent: 'Irvington' }], tagline: 'Minority-women owned. Premium cannabis, real education, and a community that has your back.', imageKey: 'hero-invented-key' },
    categories: { title: 'Shop by Category', titleAccent: 'Category' },
    weekly: [{ day: 'Monday', dayIndex: 1, detail: deal.appeared[0], terms: deal.appeared[1] }],
    badge: 'TODAY',
    initial: 'Y',
    vip: { placeholder: 'Enter your email', button: 'Subscribe', api: '/api/newsletter/subscribe', _payload: { site: 'sfd' } },
  },
  'pages/contact.json': { faq: [{ q: faq.control, a: faq.appeared[0] }] },
  'pages/category.json': { _pages: ['shop-flower', 'shop-edibles'], h1: 'Cannabis Flower — Irvington, NJ', h1b: 'Cannabis Edibles — Irvington, NJ' },
  'pages/deals.json': { title: 'Weekly Specials' }, // new page, evidence = index
  'pages/notfound.json': { title: 'Page not found' }, // new page, no evidence: must be DECLARED
  'images.json': { 'interior': { file: 'interior.webp', w: 382, h: 510, alt: 'Springfield Ave Dispensary' }, 'deco': { file: 'd.webp', alt: '' } },
  'ui-labels.json': { labels: [{ text: 'Pause motion', why: 'fixture: pause-motion control' }, { text: 'Page not found', why: 'fixture: 404 title' }] },
};
function writeSet(dir, files) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'pages'), { recursive: true });
  for (const [f, j] of Object.entries(files)) { if (j === null) continue; if (typeof j === 'string') { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), j); } else writeJSON(path.join(dir, f), j); }
}
const clone = (o) => JSON.parse(JSON.stringify(o));

function runTool(dir, name, extraArgs = []) {
  const json = path.join(LAB, 'reports', name + '.json');
  fs.mkdirSync(path.dirname(json), { recursive: true });
  fs.rmSync(json, { force: true });
  const r = spawnSync(process.execPath, [TOOL, '--content', dir, '--scan', dir, ...extraArgs, '--json', json, '--quiet'], { encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const report = fs.existsSync(json) ? readJSON(json) : null;
  return { code: r.status, out, report, last: out.trim().split('\n').filter((l) => !l.startsWith('report:')).pop() || '' };
}
const allOf = (rep, k) => (rep ? rep.files.flatMap((f) => (f[k] || []).map((x) => ({ ...x, file: f.file }))) : []);

// ---------------------------------------------------------------- mutants
// each: name, mutate(files) -> files, expect: {code, find(report) -> bool, what}
const mutants = [
  { name: 'invented-string', what: 'UNPROVED $.promo (invented copy)',
    mutate: (f) => { f['pages/index.json'].promo = 'Best prices in all of New Jersey, guaranteed'; return f; },
    find: (r) => allOf(r, 'unproved').some((u) => u.path === '$.promo') },
  { name: 'case-changed', what: 'CASE $.hero.tagline (retyped in CSS case)',
    mutate: (f) => { f['pages/index.json'].hero.tagline = f['pages/index.json'].hero.tagline.toUpperCase(); return f; },
    find: (r) => allOf(r, 'case').some((u) => u.path === '$.hero.tagline') },
  { name: 'undeclared-ui-label', what: 'UNPROVED $.pause once "Pause motion" leaves ui-labels.json',
    mutate: (f) => { f['ui-labels.json'].labels = f['ui-labels.json'].labels.filter((l) => l.text !== 'Pause motion'); return f; },
    find: (r) => allOf(r, 'unproved').some((u) => u.path === '$.pause' && u.text === 'Pause motion') },
  { name: 'forbidden-in-content', what: 'FORBIDDEN "Somerset" at pages/index.json:<line>',
    mutate: (f) => { f['pages/index.json'].visit = 'Visit our Somerset store'; return f; },
    find: (r) => r.forbidden.hits.some((h) => /pages\/index\.json$/.test(h.file) && h.line > 0 && /somerset/i.test(h.match)) },
  { name: 'forbidden-in-other-file', what: 'FORBIDDEN "hero-cjd" in a scanned non-JSON file, with file:line',
    mutate: (f) => { f['src-pages/home.mjs'] = "export const hero = 'assets/img/hero-cjd.webp';\n"; return f; },
    find: (r) => r.forbidden.hits.some((h) => /home\.mjs$/.test(h.file) && h.line === 1 && /hero-cjd/i.test(h.match)) },
  { name: 'forbidden-in-path', what: 'FORBIDDEN "cjd-logo" in a file path',
    mutate: (f) => { f['assets/cjd-logo.txt'] = 'logo\n'; return f; },
    // the alternation meets \bcjd\b first, so the recorded match is "cjd"
    find: (r) => r.forbidden.hits.some((h) => h.where === 'path' && /cjd-logo\.txt$/.test(h.file) && /cjd/i.test(h.match)) },
  { name: 'empty-content-set', what: '0 strings checked => FAIL (a comparison of nothing is not a pass)',
    mutate: () => ({ 'shared.json': {}, 'ui-labels.json': { labels: [] } }),
    find: (r) => r.totals.checked === 0 && r.problems.some((p) => /0 strings were checked/.test(p)) },
  { name: 'no-pages-dir', code: 2, what: 'content root without pages/ => exit 2 NOT-READY',
    mutate: () => ({ 'shared.json': clean['shared.json'] }), noPagesDir: true,
    find: (r) => r.status === 'NOT-READY' },
  { name: 'accent-object', what: 'accent "Newark" is not a substring of "Irvington, NJ"',
    mutate: (f) => { f['pages/index.json'].hero.h1[1].accent = 'Newark'; return f; },
    find: (r) => allOf(r, 'accent').some((a) => a.path === '$.hero.h1[1].accent') },
  { name: 'accent-sibling', what: 'titleAccent "Categories" is not a substring of title "Shop by Category"',
    mutate: (f) => { f['pages/index.json'].categories.titleAccent = 'Categories'; return f; },
    find: (r) => allOf(r, 'accent').some((a) => a.path === '$.categories.titleAccent') },
  { name: 'parts-joined', what: 'parts reordered: each part proves, the joined "Irvington, NJ Elevating" does not',
    mutate: (f) => { f['pages/index.json'].hero.h1 = [{ text: 'Irvington, NJ', accent: 'Irvington' }, 'Elevating']; return f; },
    find: (r) => allOf(r, 'unproved').some((u) => u.path === '$.hero.h1' && u.kind === 'joined') && !allOf(r, 'unproved').some((u) => u.kind === 'part' || u.kind === 'text') },
  { name: 'fragment', what: '"Irving" only occurs inside "Irvington" => UNPROVED (fragment)',
    mutate: (f) => { f['pages/index.json'].initial = 'Irving'; return f; },
    find: (r) => allOf(r, 'unproved').some((u) => u.path === '$.initial' && /fragment/.test(u.via || '')) },
  { name: 'prose-under-url-key', what: 'prose under a *Url key is still proved (suffix skip only for URL/id-like values)',
    mutate: (f) => { f['shared.json'].mapsUrl = 'Come visit us anytime, day or night'; return f; },
    find: (r) => allOf(r, 'unproved').some((u) => u.path === '$.mapsUrl') },
  { name: 'unmapped-page-file', what: 'pages/zzz-unknown.json maps to no site.json page',
    mutate: (f) => { f['pages/zzz-unknown.json'] = { title: 'Home' }; return f; },
    find: (r) => r.problems.some((p) => /zzz-unknown\.json: maps to no page/.test(p)) },
  { name: 'unknown-_pages-id', what: '"_pages" names an unknown page id',
    mutate: (f) => { f['pages/category.json']._pages.push('shop-nonexistent'); return f; },
    find: (r) => r.problems.some((p) => /unknown page id\(s\) shop-nonexistent/.test(p)) },
  { name: 'label-without-why', what: 'a ui-labels entry without a why',
    mutate: (f) => { f['ui-labels.json'].labels.push({ text: 'Filter', why: '' }); return f; },
    find: (r) => r.problems.some((p) => /without a non-empty text and why/.test(p)) },
  { name: 'new-page-undeclared', what: 'a new page (notfound, no evidence) string that is not declared',
    mutate: (f) => { f['pages/notfound.json'].body = 'The page you are looking for has moved'; return f; },
    find: (r) => allOf(r, 'unproved').some((u) => /notfound\.json$/.test(u.file) && u.path === '$.body') },
];

// ---------------------------------------------------------------- run
const results = [];
const cleanDir = path.join(LAB, 'clean');
writeSet(cleanDir, clean);
const c = runTool(cleanDir, 'clean');
const cleanOk = c.code === 0 && c.report && c.report.status === 'PASS' && c.report.totals.checked > 0 && c.report.totals.proved > 0 && c.report.totals.declared > 0;
console.log(`clean: exit ${c.code} :: ${c.last}`);
if (!cleanOk) console.log(c.out);
let caught = 0;
for (const m of mutants) {
  const dir = path.join(LAB, 'mut-' + m.name);
  const files = m.mutate(clone(clean));
  writeSet(dir, files);
  if (m.noPagesDir) fs.rmSync(path.join(dir, 'pages'), { recursive: true, force: true });
  const r = runTool(dir, 'mut-' + m.name);
  const wantCode = m.code ?? 1;
  let found = false;
  try { found = !!(r.report && m.find(r.report)); } catch (e) { found = false; }
  const ok = r.code === wantCode && found;
  if (ok) caught++;
  results.push({ name: m.name, what: m.what, exit: r.code, wantExit: wantCode, findingPresent: found, caught: ok, last: r.last });
  console.log(`${ok ? 'CAUGHT ' : 'MISSED '} ${m.name.padEnd(26)} exit ${r.code} (want ${wantCode}) finding ${found ? 'present' : 'ABSENT'} :: ${m.what}`);
  if (!ok) console.log('   ' + r.last);
  if (!KEEP) fs.rmSync(dir, { recursive: true, force: true });
}
const pass = cleanOk && caught === mutants.length;
writeJSON(path.join(P, 'audit/labs/t1/prove-content-selftest.json'), { tool: 'prove-content-selftest', at: new Date().toISOString(), clean: { exit: c.code, status: c.report && c.report.status, totals: c.report && c.report.totals, last: c.last }, mutants: results, caught, total: mutants.length, status: pass ? 'PASS' : 'FAIL' });
console.log(`SELFTEST prove-content: ${caught}/${mutants.length} mutants caught, clean ${cleanOk ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
