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
try { console.log(execFileSync('node', [SK, '--project', R, '--check'], { encoding: 'utf8' })); }
catch (e) { console.log(e.stdout || ''); console.log(e.stderr || ''); process.exit(1); }
