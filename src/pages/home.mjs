// home.mjs — the homepage: sections from src/sections/home/NN-<id>.mjs in order (each exports meta {order,id} + render(ctx)).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function render(ctx) {
  const dir = path.join(ctx.root, 'src', 'sections', 'home');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
  const mods = [];
  for (const f of files) mods.push(await import(pathToFileURL(path.join(dir, f)).href));
  mods.sort((a, b) => a.meta.order - b.meta.order);
  const only = process.env.HOME_ONLY ? process.env.HOME_ONLY.split(',') : null;   // solo section builds (lanes)
  const main = mods.filter((m) => !only || only.includes(m.meta.id) || m.meta.id === 'hero').map((m) => m.render(ctx)).join('\n');
  return { main, bodyClass: 'is-home' };
}
