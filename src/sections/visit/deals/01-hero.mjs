// 01-hero — "Weekly Specials": today's deal chip (site.js fills [data-today-text], America/New_York), Shop All Deals,
// a small lit stage of floating cut-outs (>= 900px; decorative, aria-hidden: edibles, rosin and flower, the Monday /
// Wednesday / Friday categories) and the outlined marquee of the seven deal names (decorative; the names are all in the
// cards below).
import { esc, icon } from '../../../lib/h.mjs';
import { pageHero, marquee } from '../../../lib/parts.mjs';
import { intoHero, float } from '../common.mjs';
export const meta = { order: 1, id: 'hero' };

export function render({ content: C, link }) {
  const H = C.hero, W = C.weekly;
  const chip = `<a class="dl-today glass glass--flat" href="#week"><span class="badge badge--accent">${esc(H.todayBadge)}</span><span class="dl-today__name" data-today-text></span>${icon('arrowR')}</a>`;
  const actions = `<a class="btn btn--primary btn--lg" href="${link(H.cta.href)}">${icon('bag')}${esc(H.cta.text)}</a>`;
  // the stage sits inside the hero's container (beside the copy, above the marquee), not across the whole section
  const stage = `<div class="vh-stage dl-stage" aria-hidden="true"><span class="vh-stage__halo"></span>
   ${float('cut-concentrates-280', { link, cls: 'vh-stage__a dl-stage__a vh-fade', ft: 10, r0: -2, r1: 2 })}
   ${float('visit-cut-edibles-280', { link, cls: 'vh-stage__b dl-stage__b', ft: 8, fd: -2, r0: -5, r1: -1 })}
   ${float('cut-flower-280', { link, cls: 'vh-stage__c dl-stage__c', ft: 11, fd: -5, r0: 4, r1: 8 })}
  </div>`;
  const hero = pageHero({ eyebrow: H.eyebrow, title: H.title, accent: H.titleAccent, meta: chip, actions, before: stage });
  return intoHero(hero, `<div class="dl-hero__mq" aria-hidden="true">${marquee(W.days.map((d) => d.name), { variant: 'outline', speed: 56 })}</div>`);
}
