#!/usr/bin/env node
// make-preview.mjs — derive the shareable PREVIEW copy of dist/ (what GitHub Pages serves, noindex).
//
// dist/ is the deliverable (live pages carry no robots tag; the 404 carries "noindex"). A preview on another host must
// not be indexed, so the copy gives every page ONE robots tag (inserted after its meta description, or replacing the
// 404's) and adds robots.txt (Disallow /) + .nojekyll. Nothing else changes, and the script PROVES it: each page is
// reverse-transformed and compared with dist/ byte for byte (fails closed); every other file is a byte-identical copy.
// Canonicals stay on the live domain on purpose: the live site is the real one. Every link in dist/ is relative, so the
// preview works under the GitHub Pages sub-folder (/<repo>/); the 404 links from --base (build.mjs).
//
//   node src/tools/make-preview.mjs --out <dir>      (everything in <dir> except .git is replaced)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(ROOT, 'dist');
const i = process.argv.indexOf('--out');
if (i < 0 || !process.argv[i + 1]) { console.error('usage: node src/tools/make-preview.mjs --out <dir>'); process.exit(2); }
const OUT = path.resolve(process.argv[i + 1]);
if (OUT === DIST || OUT.startsWith(DIST + path.sep)) { console.error('refusing to write inside dist/'); process.exit(2); }
const NOINDEX = '<meta name="robots" content="noindex, nofollow, noarchive, noimageindex">';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f !== '.git') fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
fs.cpSync(DIST, OUT, { recursive: true });
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const pages = walk(DIST).filter((f) => f.endsWith('.html'));
for (const f of pages) {
  const rel = path.relative(DIST, f); const src = fs.readFileSync(f, 'utf8');
  const tags = src.match(/<meta name="robots"[^>]*>/g) || [];
  let out, back;
  if (tags.length === 1) { out = src.replace(tags[0], NOINDEX); back = out.replace(NOINDEX, tags[0]); }
  else if (tags.length === 0) {
    const m = src.match(/<meta name="description"[^>]*>\n/); if (!m) { console.error('no meta description to anchor the robots tag in ' + rel); process.exit(1); }
    out = src.replace(m[0], m[0] + NOINDEX + '\n'); back = out.replace(NOINDEX + '\n', '');
  } else { console.error(`dist/${rel} has ${tags.length} robots tags`); process.exit(1); }
  if (back !== src || (out.match(/<meta name="robots"/g) || []).length !== 1) { console.error(`the preview of ${rel} differs from dist/ by more than the robots tag`); process.exit(1); }
  fs.writeFileSync(path.join(OUT, rel), out);
}
for (const f of walk(DIST).filter((x) => !x.endsWith('.html'))) { const rel = path.relative(DIST, f); if (rel === 'robots.txt') continue; if (sha(fs.readFileSync(f)) !== sha(fs.readFileSync(path.join(OUT, rel)))) { console.error('copy differs: ' + rel); process.exit(1); } }
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
const n = walk(OUT).filter((f) => !f.includes(path.sep + '.git' + path.sep)).length;
console.log(`preview written: ${OUT}\n  files   ${n} (dist ${walk(DIST).length} + .nojekyll; robots.txt = Disallow /)\n  pages   ${pages.length}, each with exactly one noindex robots tag, reverse-checked byte for byte against dist/\n  index.html sha256 ${sha(fs.readFileSync(path.join(OUT, 'index.html'))).slice(0, 16)}`);
