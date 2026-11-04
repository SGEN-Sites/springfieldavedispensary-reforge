// 03-bundles — the three live bundle cards (rendered prices, F3: From $100 / From $100 / From $180) and the live fine
// print. >= 1100px: three columns. Below: a swipe rail.
import { esc, icon } from '../../../lib/h.mjs';
import { railControls } from '../../../lib/parts.mjs';
import { float } from '../common.mjs';
export const meta = { order: 3, id: 'bundles' };

export function render({ content: C, link }) {
  const cards = C.items.map((b, n) => `<li class="bd-item" style="--i:${n}" data-reveal>
   <article class="bd-card glass${b._lit ? ' glass--lit bd-card--lit' : ''} card card--hover" aria-labelledby="bd-${n}">
    <div class="bd-card__top"><span class="icon-disc">${icon(b._icon)}</span><p class="bd-card__price">${esc(b.price)}</p>${float(b._cut, { link, cls: 'bd-card__cut' + (b._fade ? ' vh-fade' : ''), ft: 9 + n, fd: -n * 2, r0: -3, r1: 3 })}</div>
    <h3 class="bd-card__name" id="bd-${n}">${esc(b.name)}</h3>
    <p class="bd-card__tag">${esc(b.tagline)}</p>
    <p class="bd-card__text">${esc(b.text)}</p>
    <div class="bd-card__list">
     <p class="bd-card__label">${esc(C.listTitle)}</p>
     <ul role="list">${b.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>
   </article>
  </li>`).join('');
  return `<section class="bd-bundles sec--tight pool">
 <div class="container">
  <div class="carousel" data-carousel>
   <ul class="rail rail--bleed bd-rail" data-rail role="list">${cards}</ul>
   <div class="bd-controls">${railControls()}</div>
  </div>
  <p class="fine bd-fine" data-reveal>${esc(C.fine)}</p>
 </div>
</section>`;
}
