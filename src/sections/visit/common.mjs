// common.mjs — helpers shared by the visit lane's pages (contact, deals, bundles, loyalty, 404).
// Sections live in src/sections/visit/<template>/NN-<id>.mjs (each exports meta {order,id} + render(ctx)).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { esc, img } from '../../lib/h.mjs';
import { withAccent } from '../../lib/parts.mjs';

/** Render every section module of a template in meta.order. */
export async function renderSections(ctx, tpl) {
  const dir = path.join(ctx.root, 'src', 'sections', 'visit', tpl);
  const files = fs.readdirSync(dir).filter((f) => /^\d\d-.+\.mjs$/.test(f)).sort();
  const mods = [];
  for (const f of files) mods.push(await import(pathToFileURL(path.join(dir, f)).href));
  mods.sort((a, b) => a.meta.order - b.meta.order);
  return mods.map((m) => m.render(ctx)).join('\n');
}

/** Put extra markup (decoration, a marquee) inside a pageHero section, just before it closes. */
export const intoHero = (heroHtml, extra) => heroHtml.replace(/<\/section>\s*$/, `${extra}\n</section>`);

/** A decorative floating cut-out (aria-hidden, never focusable). */
export function float(key, { link, cls, ft = 9, fd = 0, r0 = -2, r1 = 2 }) {
  return `<div class="float ${cls}" style="--ft:${ft}s;--fd:${fd}s;--fr0:${r0}deg;--fr1:${r1}deg" aria-hidden="true">${img(key, { link, decorative: true })}</div>`;
}

/** Two buttons: primary accent + ghost. a/b = { text, href }; external hrefs open in a new tab. */
export function ctaPair(a, b, link, { size = '' } = {}) {
  const one = (x, cls) => {
    if (!x) return '';
    const ext = /^https?:/.test(x.href);
    return `<a class="btn ${cls}${size ? ' btn--' + size : ''}" href="${link(x.href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(x.text)}</a>`;
  };
  return one(a, 'btn--primary') + one(b, 'btn--ghost');
}

/** The lit "launching soon" closing panel (bundles + loyalty): eyebrow, h2 with accent, text, two actions. */
export function launchPanel(L, { link, id, floats = '' }) {
  return `<section class="launch pool pool--breathe" aria-labelledby="${id}">
 ${floats}
 <div class="container container--narrow">
  <div class="launch__panel glass glass--lit pad-lg" data-reveal>
   <p class="eyebrow eyebrow--center">${esc(L.eyebrow)}</p>
   <h2 id="${id}">${withAccent(L.title, L.titleAccent)}</h2>
   <p class="launch__text">${esc(L.text)}</p>
   <div class="launch__actions">${ctaPair(L.primary, L.secondary, link, { size: 'lg' })}</div>
  </div>
 </div>
</section>`;
}
