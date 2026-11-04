// 02-featured — the live FEATURED post as one wide glass card: picture left (eager: it is above the fold), text right.
import { esc, img } from '../../lib/h.mjs';
import { withAccent } from '../../lib/parts.mjs';
import { arrowText, isoDate, keepCompounds, picture } from './cards.mjs';
export const meta = { order: 2, id: 'featured' };

export function render({ content: C, link }) {
  const F = C.featured;
  return `<section class="featured pool pool--warm" aria-labelledby="featured-title">
 <div class="container">
  <div class="featured__wrap" data-reveal>
   <a class="featured__card glass glass--lit card card--link" href="${link(F.href)}">
    <div class="featured__media">${img(picture(F.imageKey), { link, decorative: true, eager: true, fetchpriority: 'high', sizes: '(min-width: 1320px) 700px, (min-width: 900px) 55vw, calc(100vw - 32px)' })}</div>
    <div class="featured__body">
     <span class="post-meta"><span class="badge badge--live">${esc(F.badge)}</span><time class="post-meta__date" datetime="${isoDate(F.date)}">${esc(F.date)}</time></span>
     <h2 id="featured-title" class="featured__title">${keepCompounds(withAccent(F.title.text, F.title.accent))}</h2>
     <p class="featured__excerpt">${esc(F.excerpt)}</p>
     <span class="featured__cta">${arrowText(F.cta)}</span>
    </div>
   </a>
  </div>
 </div>
</section>`;
}
