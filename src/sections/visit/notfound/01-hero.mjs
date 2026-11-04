// 01-hero — the branded 404: a big outlined "404" (declared), "Page not found" (declared), one declared line, and the
// way back: Shop Now, Home, Deals, Contact (live chrome words). Links are root-absolute (build.mjs --base) because a
// host serves this file at any missing path.
import { esc, icon } from '../../../lib/h.mjs';
import { pageHero } from '../../../lib/parts.mjs';
import { intoHero, float } from '../common.mjs';
export const meta = { order: 1, id: 'hero' };

export function render({ content: C, link }) {
  const code = `<p class="nf-code" aria-hidden="true">${esc(C.code)}</p>`;
  const actions = `<a class="btn btn--primary btn--lg" href="${link(C.primary.href)}">${icon('bag')}${esc(C.primary.text)}</a>`
    + C.links.map((l) => `<a class="btn btn--ghost btn--lg" href="${link(l.href)}">${esc(l.text)}</a>`).join('');
  const hero = pageHero({ before: code, eyebrow: C.eyebrow, title: C.title.text, accent: C.title.accent, lede: C.lede, actions, variant: 'center' });
  const floats = `<div class="nf-floats" aria-hidden="true">${float('cut-flower-280', { link, cls: 'nf-f1', ft: 10, r0: -6, r1: -1 })}${float('cut-concentrates-280', { link, cls: 'nf-f2 vh-fade', ft: 12, fd: -4, r0: 2, r1: 6 })}</div>`;
  return intoHero(hero, floats);
}
