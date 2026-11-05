// 02-article — the framed picture (eager, framed; 16:9, 2.2:1 from 900px wide), or for an owner-supplied post its drawn
// cover; then the reading column: key takeaways + "In this article" (when the post has them), every body block (the live
// posts: plain paragraphs; owner-supplied posts: headings, lists, tables, callouts — src/sections/post/rich.mjs), the
// recipe card, the FAQ, the sources and the 21+ note; last the visit row: the store's address (shared.json, the same line
// as the footer) with "Shop the Menu →" and Get Directions.
// The one section allowed to run longer than a screen (it is the article). No aria-labelledby: the hero region is the
// one named by the h1, so a screen reader's landmark list shows the post title once.
import { esc, img, icon } from '../../lib/h.mjs';
import { arrowText, picture, coverArt } from '../blog/cards.mjs';
import { blocksHtml, takeaways, toc, recipe, faq, sources, note } from './rich.mjs';
export const meta = { order: 2, id: 'article' };

export function render({ content: C, link, S }) {
  const figure = C.cover
    ? `<figure class="post-figure post-figure--cover frame">${coverArt(C.cover, C.catLabel, { hero: true })}</figure>`
    : `<figure class="post-figure frame">${img(picture(C.pictureKey), { link, alt: C.pictureAlt, eager: true, fetchpriority: 'high', sizes: '(min-width: 1060px) 960px, calc(100vw - 32px)' })}</figure>`;
  const ctx = { tables: 0 };   // one counter per page: every table box gets a page-unique name
  const paras = C.body.map((p) => (typeof p === 'string' ? `<p>${esc(p)}</p>` : blocksHtml([p], link, ctx))).join('\n   ');
  const lead = C.takeaways || C.toc ? `<div class="post-lead">${C.takeaways ? takeaways(C.takeaways, link) : ''}${C.toc ? toc(C.toc) : ''}</div>` : '';
  const extras = [C.recipe ? recipe(C.recipe, link, ctx) : '', C.faq ? faq(C.faq, link, ctx) : '', C.sources ? sources(C.sources) : '', C.note ? note(C.note) : ''].filter(Boolean).join('\n  ');
  return `<section class="post-article pool" data-tall="the article itself: every body block in one readable column (the brief lets a post run longer than a screen)">
 <div class="container">
  ${figure}
  ${lead}
  <div class="post-prose">
   ${paras}
  </div>
  ${extras}
  <div class="post-cta">
   <p class="post-visit">${icon('pin')}<span>${esc(S.address.oneLine)}</span></p>
   <div class="post-cta__actions">
    <a class="btn btn--primary btn--lg" href="${link(C.shop.href)}">${arrowText(C.shop.text)}</a>
    <a class="btn btn--ghost btn--lg" href="${esc(S.directionsHref)}" target="_blank" rel="noopener">${icon('map')}${esc(S.dock.directions)}</a>
   </div>
  </div>
 </div>
</section>`;
}
