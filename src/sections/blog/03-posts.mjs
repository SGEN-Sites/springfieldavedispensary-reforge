// 03-posts — "Categories" filters (live: All, Education, Deals & Picks, Updates, Community; + Recipes for the
// owner-supplied posts) over every article card, as a grid: four across from 1100px, three from 900px, two from 600px,
// one on phones. Filtering: site.js [data-filter-group]; Updates has no posts, so the declared empty-state line shows.
// Paging: blog.js shows posts.pageSize cards of the current category and the live "Load More" button the next page
// (hidden without JS, so a no-JS visitor sees every card).
import { esc } from '../../lib/h.mjs';
import { postCard } from './cards.mjs';
export const meta = { order: 3, id: 'posts' };

export function render({ content: C, link }) {
  const K = C.posts;
  const size = K.pageSize || 0;
  const chips = K.filters.map((f, n) => `<button type="button" class="chip" aria-pressed="${n === 0 ? 'true' : 'false'}" data-cat="${esc(f.catSlug)}">${esc(f.text)}</button>`).join('');
  const items = K.items.map((p, n) => `<li class="posts__item" data-filter-item data-cat="${esc(p.catSlug)}" style="--i:${size ? n % size : n}" data-reveal>
   ${postCard(p, { link, readMore: K.readMore, sizes: '(min-width: 1100px) 300px, (min-width: 900px) 30vw, (min-width: 600px) 45vw, calc(100vw - 32px)' })}
  </li>`).join('');
  return `<section class="posts pool" id="posts" aria-labelledby="posts-title" data-tall="the article list: a page of cards, then Load More">
 <div class="container">
  <div class="posts__bar" data-reveal>
   <h2 id="posts-title" class="eyebrow posts__label">${esc(K.label)}</h2>
   <div class="filters posts__filters" role="group" aria-labelledby="posts-title" data-filter-group data-filter-scope="#posts">${chips}</div>
  </div>
  <ul class="posts__grid" role="list"${size ? ` data-page-size="${size}"` : ''}>${items}</ul>
  <p class="posts__empty glass glass--flat" data-filter-empty role="status" hidden>${esc(K.empty)}</p>
  ${K.loadMore ? `<div class="posts__more"><button type="button" class="btn btn--ghost btn--lg" data-load-more hidden>${esc(K.loadMore)}</button></div>` : ''}
 </div>
</section>`;
}
