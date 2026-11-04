#!/usr/bin/env node
// ledger.mjs — fill the skill's change-control ledger (reforge/audit/change-control.json) through sr-plan --set, one
// decision per live section row, then sr-plan --check. Every row of this redesign keeps the live copy and rebuilds the
// section on the design system (IMPROVE); the Dutchie embed containers are kept as the live embed (PRESERVE).
// Required narrative slots map to the real sections that carry them; social proof is OMITTED (no testimonials exist —
// never invented). Removals declared by lanes (src/content/removals*.json) do not remove sections, only strings.
//   node src/tools/ledger.mjs
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SK = '/Users/carlcelino/.claude-osoft/skills/site-reforge/scripts/sr-plan.mjs';
const R = path.join(ROOT, 'reforge');
const ledger = JSON.parse(fs.readFileSync(path.join(R, 'audit', 'change-control.json'), 'utf8'));
const SLOTS = {
  'springfieldavedispensary.store/#s4': 'value-proposition',
  'springfieldavedispensary.store/about#s1': 'trust-positioning',
  'springfieldavedispensary.store/#s9': 'benefits-solution',
  'springfieldavedispensary.store/#s1': 'strategic-cta',
  'springfieldavedispensary.store/contact#s2': 'footer',
};
let n = 0;
for (const r of ledger.rows) {
  const embed = /flex-1 pt-6 pb-16 bg-white/.test(r.heading || r.label || '');
  const decision = embed ? 'PRESERVE' : 'IMPROVE';
  const why = embed
    ? 'the live Dutchie embedded menu (same script id 699a62e4906190ac014a622c, same iframe paths per category), kept functional in a restyled, height-reserved slot'
    : 'every live word of this section kept (proved by src/tools/prove-content.mjs + parity.mjs); rebuilt on the redesign system per docs/OWNER-BRIEF.md (glass, light, editorial type, rails on phones)';
  const args = [SK, '--project', R, '--set', r.id, '--decision', decision, '--why', why];
  if (SLOTS[r.id]) args.push('--slot', SLOTS[r.id]);
  execFileSync('node', args, { stdio: 'pipe' }); n++;
}
console.log(`set ${n} rows`);
// the two pages the brief ADDS (no source section exists for them): recorded as ADD rows with their reason. sr-plan has
// no add command; a refresh keeps rows absent from the crawl ("kept and flagged, never dropped"), so these persist.
{
  const f = path.join(R, 'audit', 'change-control.json');
  const L = JSON.parse(fs.readFileSync(f, 'utf8'));
  const ADDS = [
    { id: 'springfieldavedispensary.store/deals#add', url: 'https://springfieldavedispensary.store/deals', label: 'Deals page (new)', rebuiltAs: 'deals/index.html',
      why: 'owner brief page 8: "Deals: the full weekly specials and bulk offers on one page" — built only from the live homepage deal copy and the 7 live deal dialogs (no new claims)' },
    { id: 'springfieldavedispensary.store/404#add', url: 'https://springfieldavedispensary.store/404', label: '404 page (new)', rebuiltAs: '404.html',
      why: 'owner brief page 9: "404 page in the same style" — the live 404 was a developer placeholder; declared wording in src/content/ui-labels.d/visit.json' },
  ];
  for (const a of ADDS) {
    const row = { id: a.id, url: a.url, pageType: 'page', index: 0, label: a.label, sourceTag: '(none: added)', sourceClass: '', decision: 'ADD', why: a.why, narrativeSlot: '', presetId: '', rebuiltAs: a.rebuiltAs };
    const at = L.rows.findIndex((r) => r.id === a.id);
    if (at >= 0) L.rows[at] = row; else L.rows.push(row);
  }
  L.rowCount = L.rows.length;
  fs.writeFileSync(f, JSON.stringify(L, null, 2));
  console.log(`ADD rows: ${ADDS.map((a) => a.rebuiltAs).join(', ')}`);
}
try { console.log(execFileSync('node', [SK, '--project', R, '--check'], { encoding: 'utf8' })); }
catch (e) { console.log(e.stdout || ''); console.log(e.stderr || ''); process.exit(1); }
