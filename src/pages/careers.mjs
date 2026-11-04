// careers.mjs — Careers (lane story): sections from src/sections/careers/NN-<id>.mjs in order; careers.js wires
// "Apply Now" -> #apply with the role preselected.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function render(ctx) {
  const dir = path.join(ctx.root, 'src', 'sections', 'careers');
  const mods = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs')).sort()) mods.push(await import(pathToFileURL(path.join(dir, f)).href));
  mods.sort((a, b) => a.meta.order - b.meta.order);
  return { main: mods.map((m) => m.render(ctx)).join('\n'), bodyClass: 'is-careers', scripts: ['assets/js/careers.js'] };
}
