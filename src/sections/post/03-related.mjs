// 03-related — "More from Dispatch": the three live related cards. >= 768px: three across. Phones: a swipe rail.
import { sectionHead, railControls } from '../../lib/parts.mjs';
import { postCard } from '../blog/cards.mjs';
export const meta = { order: 3, id: 'related' };

export function render({ content: C, link }) {
  const R = C.related;
  const items = R.items.map((p, n) => `<li class="related__item" style="--i:${n}" data-reveal>${postCard(p, { link, compact: true, sizes: '(min-width: 1100px) 400px, (min-width: 768px) 31vw, 78vw' })}</li>`).join('');
  return `<section class="related pool pool--warm" aria-labelledby="related-title">
 <div class="container">
  ${sectionHead({ eyebrow: R.eyebrow, title: R.title.text, accent: R.title.accent, link, id: 'related-title' })}
  <div class="carousel related__carousel" data-carousel>
   <ul class="rail rail--bleed related__rail" data-rail role="list">${items}</ul>
   <div class="related__controls">${railControls()}</div>
  </div>
 </div>
</section>`;
}
