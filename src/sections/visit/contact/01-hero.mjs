// 01-hero — compact page hero: "Contact Us", the live lede, a jump to the form and the live directions link; from
// 900px a small lit stage beside the copy (decorative, aria-hidden): the store's own interior photo in a tilted glass
// frame (the homepage hero's look, smaller) with one floating cut-out.
import { img } from '../../../lib/h.mjs';
import { pageHero } from '../../../lib/parts.mjs';
import { ctaPair, intoHero, float } from '../common.mjs';
export const meta = { order: 1, id: 'hero' };

export function render({ content: C, link }) {
  const H = C.hero;
  const hero = pageHero({ eyebrow: H.eyebrow, title: H.title, accent: H.titleAccent, lede: H.lede, actions: ctaPair(H.primary, H.secondary, link) });
  const stage = `<div class="vh-stage ct-stage" aria-hidden="true"><span class="vh-stage__halo"></span>
  <span class="ct-stage__frame frame">${img('interior', { link, decorative: true })}</span>
  ${float('cut-prerolls-280', { link, cls: 'ct-stage__cut', ft: 9, fd: -3, r0: 6, r1: 2 })}
 </div>`;
  return intoHero(hero, stage);
}
