#!/usr/bin/env node
// gate-workspace.mjs — the graded workspace for the skill's gate (sr-gate.mjs) on this REDESIGN, at P/reforge.
// Why a separate workspace: sr-tokens.mjs and sr-motion.mjs write into <project>/src/styles (they would overwrite the
// hand-built tokens.css), and sr-extract reads audit/raw/, which here must be the BROWSER-RENDERED pages (the live site is
// an SPA: its server HTML for / is an empty #root). The project's own audit/raw/ is never edited.
//   reforge/project.json                 copy of P/project.json
//   reforge/audit/site-inventory.json    copy (the crawl)
//   reforge/audit/raw/<savedAs>          = P/audit/pages/<id>/rendered.html (the browser capture of each live page)
//   reforge/audit/robots.txt, failures.json   copies (failures only when reforge has none, so accepted records survive)
//   reforge/facts/                       copy of P/facts
//   reforge/docs -> ../docs, reforge/dist -> ../dist   (symlinks: the gate grades the real build and docs)
//   reforge/src/styles/*.css             COPIES of P/src/styles/*.css (top level, what C13 reads) — refreshed every run
//   node src/tools/gate-workspace.mjs [--check]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const R = path.join(ROOT, 'reforge');
const CHECK = process.argv.includes('--check');
const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'site-inventory.json'), 'utf8'));
const problems = [];
const mk = (p) => { if (!CHECK) fs.mkdirSync(p, { recursive: true }); };
const cp = (a, b) => { if (!CHECK) { mk(path.dirname(b)); fs.copyFileSync(a, b); } };
const link = (target, at) => {
  const exists = fs.existsSync(at) || (() => { try { fs.lstatSync(at); return true; } catch { return false; } })();
  if (exists) { const st = fs.lstatSync(at); if (!st.isSymbolicLink()) problems.push(`${path.relative(ROOT, at)} exists and is not a symlink`); return; }
  if (!CHECK) fs.symlinkSync(target, at);
};
mk(path.join(R, 'audit', 'raw'));
cp(path.join(ROOT, 'project.json'), path.join(R, 'project.json'));
cp(path.join(ROOT, 'audit', 'site-inventory.json'), path.join(R, 'audit', 'site-inventory.json'));
cp(path.join(ROOT, 'audit', 'robots.txt'), path.join(R, 'audit', 'robots.txt'));
if (!fs.existsSync(path.join(R, 'audit', 'failures.json'))) cp(path.join(ROOT, 'audit', 'failures.json'), path.join(R, 'audit', 'failures.json'));
let raw = 0;
for (const p of inv.pages) {
  const id = p.savedAs.replace(/\.html$/, '');
  const src = path.join(ROOT, 'audit', 'pages', id, 'rendered.html');
  if (!fs.existsSync(src)) { problems.push('no rendered capture for ' + id); continue; }
  cp(src, path.join(R, 'audit', 'raw', p.savedAs)); raw++;
  // live text that exists only AFTER a click (the 7 deal dialogs, FAQ answers, role details) was captured by
  // capture-expanded.mjs; it is appended to the graded raw page in a marked block so the skill's graders see it too
  // only text that is NOT already in the rendered DOM (careers' role details are in the DOM, hidden; appending them again
  // would double-count them in the graders' word recall)
  const domText = fs.readFileSync(src, 'utf8').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const absent = (t) => !domText.includes(String(t).replace(/\s+/g, ' ').trim());
  const extra = [];
  const dm = path.join(ROOT, 'audit', 'pages', id, 'deal-modals.json');
  if (fs.existsSync(dm)) for (const c of JSON.parse(fs.readFileSync(dm, 'utf8')).clicks || []) if (c.dialog && c.dialog.html && (c.appeared || []).some(absent)) extra.push(c.dialog.html);
  const ex = path.join(ROOT, 'audit', 'pages', id, 'expanded.json');
  if (fs.existsSync(ex)) for (const c of JSON.parse(fs.readFileSync(ex, 'utf8')).clicks || []) for (const l of c.appeared || []) if (absent(l)) extra.push('<p>' + l.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>');
  if (extra.length && !CHECK) {
    const f = path.join(R, 'audit', 'raw', p.savedAs);
    const html = fs.readFileSync(f, 'utf8');
    const block = `<section data-captured="after-click" data-source="audit/pages/${id}/${fs.existsSync(dm) ? 'deal-modals.json' : 'expanded.json'}">${extra.join('\n')}</section>`;
    // inside <main>: sr-extract reads bodyText from <main> when the page has one (sr-extract.mjs:166)
    const at = html.lastIndexOf('</main>');
    fs.writeFileSync(f, at >= 0 ? html.slice(0, at) + block + html.slice(at) : html.includes('</body>') ? html.replace('</body>', block + '</body>') : html + block);
  }
}
for (const f of fs.readdirSync(path.join(ROOT, 'facts'))) cp(path.join(ROOT, 'facts', f), path.join(R, 'facts', f));
link('../docs', path.join(R, 'docs'));
link('../dist', path.join(R, 'dist'));
mk(path.join(R, 'src', 'styles'));
const sheets = fs.readdirSync(path.join(ROOT, 'src', 'styles')).filter((f) => f.endsWith('.css'));
for (const f of sheets) cp(path.join(ROOT, 'src', 'styles', f), path.join(R, 'src', 'styles', f));
// a stale copy of a sheet that no longer exists would be graded: remove copies with no source
if (!CHECK && fs.existsSync(path.join(R, 'src', 'styles'))) for (const f of fs.readdirSync(path.join(R, 'src', 'styles'))) if (f.endsWith('.css') && !sheets.includes(f)) fs.unlinkSync(path.join(R, 'src', 'styles', f));
// prove the copies equal the sources
for (const f of sheets) { const a = path.join(ROOT, 'src', 'styles', f), b = path.join(R, 'src', 'styles', f); if (!fs.existsSync(b) || !fs.readFileSync(a).equals(fs.readFileSync(b))) problems.push('src/styles/' + f + ' copy differs'); }
console.log(`reforge workspace: ${raw}/${inv.pages.length} rendered pages as audit/raw, ${sheets.length} style sheets copied, docs + dist linked`);
if (problems.length) { console.log('PROBLEMS:\n  ' + problems.join('\n  ')); process.exit(1); }
