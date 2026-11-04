// 02-article — the picture (eager, framed; 16:9, 2.2:1 from 900px wide), every live body paragraph in a readable column, "Shop the Menu →".
// The one section allowed to run longer than a screen (it is the article). No aria-labelledby: the hero region is the
// one named by the h1, so a screen reader's landmark list shows the post title once.
import { esc, img } from '../../lib/h.mjs';
import { arrowText, picture } from '../blog/cards.mjs';
export const meta = { order: 2, id: 'article' };

export function render({ content: C, link }) {
  const paras = C.body.map((p) => `<p>${esc(p)}</p>`).join('\n   ');
  return `<section class="post-article pool" data-tall="the article itself: every live body paragraph in one readable column (the brief lets a post run longer than a screen)">
 <div class="container">
  <figure class="post-figure frame">${img(picture(C.pictureKey), { link, alt: C.pictureAlt, eager: true, fetchpriority: 'high', sizes: '(min-width: 1060px) 960px, calc(100vw - 32px)' })}</figure>
  <div class="post-prose">
   ${paras}
  </div>
  <div class="post-cta">
   <a class="btn btn--primary btn--lg" href="${link(C.shop.href)}">${arrowText(C.shop.text)}</a>
  </div>
 </div>
</section>`;
}
