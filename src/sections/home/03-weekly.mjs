// 03-weekly — the seven daily deals (today highlighted, America/New_York), each opens its detail dialog (live behaviour);
// a marquee of the deal names; View All Deals -> the Deals page. Phones: a swipe rail that starts at today.
import { esc } from '../../lib/h.mjs';
import { sectionHead, railControls, dealCard, marquee } from '../../lib/parts.mjs';
export const meta = { order: 3, id: 'weekly' };

export function render({ content: C, link }) {
  const W = C.weekly;
  const cards = W.days.map((d, n) => dealCard(d, { todayBadge: W.todayBadge, shop: W.dealShop, link, n })).join('');
  return `<section class="weekly pool pool--warm" id="weekly-specials" aria-labelledby="weekly-title">
 <div class="weekly__mq" aria-hidden="true">${marquee(W.days.map((d) => d.name), { variant: 'outline', speed: 52 })}</div>
 <div class="container">
  ${sectionHead({ eyebrow: W.eyebrow, title: W.title, accent: W.titleAccent, action: W.action, link, id: 'weekly-title' })}
  <div class="carousel weekly__carousel" data-carousel>
   <ul class="rail rail--bleed weekly__rail" data-rail data-today-scroll role="list">${cards}</ul>
   <div class="weekly__foot">
    <a class="btn btn--ghost" href="${link(W.shopAll.href)}">${esc(W.shopAll.text)}</a>
    <div class="weekly__controls">${railControls()}</div>
   </div>
  </div>
 </div>
</section>`;
}
