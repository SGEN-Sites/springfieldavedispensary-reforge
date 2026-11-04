// 03-posts — "Categories" filters (live: All, Education, Deals & Picks, Updates, Community) over the four article cards.
// Desktop (>= 1100px): one row of four. Tablet + phones: a swipe rail with arrows. Filtering: site.js [data-filter-group];
// Updates has no posts, so the declared empty-state line shows. blog.js re-syncs the rail after a filter.
import { esc } from '../../lib/h.mjs';
import { railControls } from '../../lib/parts.mjs';
import { postCard } from './cards.mjs';
export const meta = { order: 3, id: 'posts' };

export function render({ content: C, link }) {
  const K = C.posts;
  const chips = K.filters.map((f, n) => `<button type="button" class="chip" aria-pressed="${n === 0 ? 'true' : 'false'}" data-cat="${esc(f.catSlug)}">${esc(f.text)}</button>`).join('');
  const items = K.items.map((p, n) => `<li class="posts__item" data-filter-item data-cat="${esc(p.catSlug)}" style="--i:${n}" data-reveal>
   ${postCard(p, { link, readMore: K.readMore, sizes: '(min-width: 1100px) 300px, (min-width: 768px) 44vw, 80vw' })}
  </li>`).join('');
  return `<section class="posts pool" id="posts" aria-labelledby="posts-title">
 <div class="container">
  <div class="carousel posts__carousel" data-carousel>
   <div class="posts__bar" data-reveal>
    <h2 id="posts-title" class="eyebrow posts__label">${esc(K.label)}</h2>
    <div class="filters posts__filters" role="group" aria-labelledby="posts-title" data-filter-group data-filter-scope="#posts">${chips}</div>
   </div>
   <ul class="rail rail--bleed posts__rail" data-rail role="list">${items}</ul>
   <div class="posts__controls">${railControls()}</div>
   <p class="posts__empty glass glass--flat" data-filter-empty role="status" hidden>${esc(K.empty)}</p>
  </div>
 </div>
</section>`;
}
