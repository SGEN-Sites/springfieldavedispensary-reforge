// 03-order — the brief's "pickup and delivery info": the homepage's live Ways to Order copy + the live "Ready to order?" strip.
import { esc, icon } from '../../../lib/h.mjs';
import { sectionHead } from '../../../lib/parts.mjs';
export const meta = { order: 3, id: 'order' };

export function render({ content: C, link }) {
  const O = C.order;
  const cards = O.methods.map((m, n) => `<li class="ct-way glass card card--hover" style="--i:${n}" data-reveal>
    <span class="icon-disc">${icon(m.icon)}</span>
    <div><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></div>
   </li>`).join('');
  return `<section class="ct-order pool pool--warm" aria-labelledby="ct-order-title">
 <div class="container">
  ${sectionHead({ eyebrow: O.eyebrow, title: O.title, accent: O.titleAccent, lede: O.lede, link, id: 'ct-order-title' })}
  <ul class="ct-ways" role="list">${cards}</ul>
  <div class="ct-ready glass glass--flat" data-reveal>
   <div><h3>${esc(O.ready.title)}</h3><p>${esc(O.ready.text)}</p></div>
   <a class="btn btn--primary" href="${link(O.ready.cta.href)}">${icon('bag')}${esc(O.ready.cta.text)}</a>
  </div>
 </div>
</section>`;
}
