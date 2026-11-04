// 02-categories — six dark product-photography tiles. Desktop: one row. Tablet: 3 x 2. Phones: a swipe rail.
import { esc, img } from '../../lib/h.mjs';
import { sectionHead, railControls } from '../../lib/parts.mjs';
export const meta = { order: 2, id: 'categories' };

export function render({ content: C, link }) {
  const K = C.categories;
  const tiles = K.items.map((t, n) => `<li style="--i:${n}" data-reveal><a class="tile" href="${link(t.href)}">
   ${img([`cat-${t.imageKey}-360`, `cat-${t.imageKey}-560`], { link, alt: t.alt, sizes: '(min-width: 1100px) 200px, (min-width: 768px) 30vw, 46vw' })}
   <span class="tile__body"><span class="tile__name">${esc(t.name)}</span><span class="tile__sub">${esc(t.sub)}</span></span>
  </a></li>`).join('');
  return `<section class="cats pool" id="categories" aria-labelledby="cats-title">
 <div class="container">
  ${sectionHead({ eyebrow: K.eyebrow, title: K.title, accent: K.titleAccent, action: K.action, link, id: 'cats-title' })}
  <div class="carousel cats__carousel" data-carousel>
   <ul class="rail rail--bleed cats__rail" data-rail role="list">${tiles}</ul>
   <div class="cats__controls">${railControls()}</div>
  </div>
 </div>
</section>`;
}
