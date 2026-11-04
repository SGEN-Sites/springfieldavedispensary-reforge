// 01-hero — "Curated Bundles": the live Coming Soon + In-Store Exclusive badges, the intro, and (desktop) a small lit
// stage of floating product cut-outs from the real Springfield category photos (decorative).
import { esc } from '../../../lib/h.mjs';
import { pageHero } from '../../../lib/parts.mjs';
import { intoHero, float, ctaPair } from '../common.mjs';
export const meta = { order: 1, id: 'hero' };

export function render({ content: C, link }) {
  const H = C.hero;
  const badges = `<div class="vh-badges">${H.badges.map((b, i) => `<span class="badge${i === 0 ? ' badge--soon' : ''}">${esc(b)}</span>`).join('')}</div>`;
  // the live Launching Soon pair (Browse the Menu + Contact Us) repeated in the hero: a fast path to the menu in the first screen
  const hero = pageHero({ before: badges, title: H.title, accent: H.titleAccent, lede: H.lede, actions: ctaPair(C.launch.primary, C.launch.secondary, link) });
  const stage = `<div class="vh-stage" aria-hidden="true"><span class="vh-stage__halo"></span>
  ${float('cut-flower-440', { link, cls: 'vh-stage__a', ft: 10, r0: -3, r1: 2 })}
  ${float('cut-prerolls-280', { link, cls: 'vh-stage__b', ft: 8, fd: -2, r0: 6, r1: 2 })}
  ${float('cut-concentrates-280', { link, cls: 'vh-stage__c vh-fade', ft: 11, fd: -5, r0: -1, r1: 3 })}
 </div>`;
  return intoHero(hero, stage);
}
