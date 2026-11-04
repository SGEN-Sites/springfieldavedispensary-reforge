// 07-order — "Convenience" / "Ways to Order": three method cards + the highlighted "Ready to order?" card (View Full Menu).
// Desktop: a split bento (head + ready card left, the three methods stacked right). Phones: a compact list, then the ready card.
import { esc, icon, img } from '../../lib/h.mjs';
import { sectionHead } from '../../lib/parts.mjs';
export const meta = { order: 7, id: 'order' };

export function render({ content: C, link }) {
  const O = C.order;
  const methods = O.methods.map((m, i) => `<li class="method glass card card--hover" style="--i:${i + 1}" data-reveal>
    <span class="icon-disc">${icon(m.icon)}</span>
    <div class="method__body"><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></div>
   </li>`).join('');
  return `<section class="order pool" id="ways-to-order" aria-labelledby="order-title">
 <div class="container order__grid">
  <div class="order__head">${sectionHead({ eyebrow: O.eyebrow, title: O.title, accent: O.titleAccent, lede: O.lede, link, id: 'order-title' })}</div>
  <ul class="order__methods" role="list">${methods}</ul>
  <div class="order__ready glass glass--accent" data-reveal style="--i:2">
   <div class="order__ready-copy">
    <h3>${esc(O.ready.title)}</h3>
    <p>${esc(O.ready.text)}</p>
    <a class="btn btn--primary" href="${link(O.ready.cta.href)}">${esc(O.ready.cta.text)}</a>
   </div>
   <div class="float order__float" style="--ft:10s;--fr0:-8deg;--fr1:-4deg" aria-hidden="true">${img('cut-prerolls-280', { link, decorative: true })}</div>
  </div>
 </div>
</section>`;
}
