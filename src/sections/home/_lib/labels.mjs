// labels.mjs (home lane) — the only way a home section 04-10 may print a string that is not in content/pages/index.json.
// L(text) returns text only when it is DECLARED in src/content/ui-labels.json (lead) or src/content/ui-labels.d/home.json
// (this lane); otherwise the build throws, so an undeclared string can never ship.
// Lives in a sub-folder: src/pages/home.mjs imports every *.mjs directly inside src/sections/home as a section.
import fs from 'node:fs';
import path from 'node:path';

const cache = new Map();
export function labels(root) {
  if (cache.has(root)) return cache.get(root);
  const declared = new Set();
  for (const f of [path.join(root, 'src', 'content', 'ui-labels.json'), path.join(root, 'src', 'content', 'ui-labels.d', 'home.json')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of JSON.parse(fs.readFileSync(f, 'utf8')).labels || []) if (l && l.text && String(l.why || '').trim()) declared.add(l.text);
  }
  const L = (t) => {
    if (!declared.has(t)) throw new Error(`home lane: "${t}" is not declared in src/content/ui-labels.json or src/content/ui-labels.d/home.json`);
    return t;
  };
  cache.set(root, L);
  return L;
}
