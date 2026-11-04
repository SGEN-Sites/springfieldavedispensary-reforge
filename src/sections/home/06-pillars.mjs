// 06-pillars — "Why Us" / "More Than a Dispensary": four glass cards with an icon disc. Desktop 4-up, phones a compact 2 x 2.
import { esc, icon } from '../../lib/h.mjs';
import { sectionHead } from '../../lib/parts.mjs';
export const meta = { order: 6, id: 'pillars' };

export function render({ content: C, link }) {
  const P = C.pillars;
  const cards = P.items.map((it, i) => `<li class="pillar glass card card--hover" style="--i:${i}" data-reveal>
    <span class="icon-disc">${icon(it.icon)}</span>
    <h3>${esc(it.title)}</h3>
    <p>${esc(it.text)}</p>
   </li>`).join('');
  return `<section class="pillars pool pool--warm" id="why-us" aria-labelledby="pillars-title">
 <div class="container">
  ${sectionHead({ eyebrow: P.eyebrow, title: P.title, accent: P.titleAccent, link, id: 'pillars-title', center: true })}
  <ul class="pillars__grid" role="list">${cards}</ul>
 </div>
</section>`;
}
