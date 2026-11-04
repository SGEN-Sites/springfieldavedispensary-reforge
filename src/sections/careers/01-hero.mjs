// 01-hero — "Grow With Us": the live intro, the four perks as compact one-row glass tiles (a stack in the right column on
// desktop, with one floating product cut-out half behind the frosted tiles; the cut-out is decoration, desktop only),
// Apply Now + Open Roles.
import { esc, icon, img } from '../../lib/h.mjs';
import { pageHero } from '../../lib/parts.mjs';
export const meta = { order: 1, id: 'hero' };

export function render({ content: C, link }) {
  const H = C.hero;
  const perks = `<div class="careers-perks"><ul class="perks" role="list">${H.perks.map((p, n) => `<li class="perk glass glass--flat" style="--i:${n + 1}" data-reveal><span class="icon-disc perk__ico">${icon(p.icon)}</span><span class="perk__t">${esc(p.text)}</span></li>`).join('')}</ul>`
    + `<div class="float careers-perks__bud" style="--ft:10s;--fr0:-5deg;--fr1:2deg" aria-hidden="true">${img(['cut-flower-280', 'cut-flower-440'], { link, decorative: true, sizes: '190px' })}</div></div>`;
  const actions = `<a class="btn btn--primary btn--lg" href="${link(H.ctaPrimary.href)}">${esc(H.ctaPrimary.text)}</a><a class="btn btn--ghost btn--lg" href="${link(H.ctaSecondary.href)}">${esc(H.ctaSecondary.text)}</a>`;
  return pageHero({ eyebrow: H.eyebrow, title: H.title, accent: H.titleAccent, lede: H.lede, meta: perks, actions, id: 'page-title' });
}
