// 02-embed — the sticky category filter row + the live Dutchie embedded menu (full container width).
// Filters are real links to the live targets (/shop, /shop/<slug>) and navigate like the live site. On /shop/
// (readParam) menu.js opens the category named by ?dtche[category]=<slug> (the homepage tiles' links) and marks its chip.
// The slot reserves the embed's height, shows a light skeleton until the iframe loads, and a link to the Dutchie menu
// when JS is off or the embed is blocked.
// Never wrap the slot in .glass / data-reveal / transform / filter: Dutchie's fullscreen checkout is position:fixed and
// any of those would trap it inside the frame.
import { esc, icon } from '../../lib/h.mjs';

export function embed({ content: C, link, page }, { readParam = false } = {}) {
  const F = C.filters, E = C.embed;
  const cur = E.category || '';
  const own = page.path; // 'shop/' or 'shop/<slug>/'
  const chips = F.items.map((it) => {
    const to = it.slug ? `shop/${it.slug}/` : 'shop/';
    const current = to === own ? ' aria-current="page"' : '';
    return `<li><a class="chip menu-chip" href="${link(to)}" data-slug="${esc(it.slug)}"${current}>${esc(it.text)}</a></li>`;
  }).join('');
  const slugs = F.items.map((it) => it.slug).filter(Boolean).join(' ');
  const skelCards = Array.from({ length: 8 }, () => '<span class="menu-skel__card"><span class="menu-skel__img"></span><span class="menu-skel__line"></span><span class="menu-skel__line menu-skel__line--short"></span><span class="menu-skel__btn"></span></span>').join('');

  return `<section class="menu-embed" id="menu" aria-label="${esc(E.label)}" data-tall="Dutchie menu embed">
 <div class="menu-bar">
  <div class="container menu-bar__in">
   <nav class="menu-cats" aria-label="${esc(F.label)}" data-menu-filters><ul class="filters menu-cats__list" role="list">${chips}</ul></nav>
  </div>
 </div>
 <div class="container menu-stage">
  <div class="menu-frame">
   <div class="menu-slot" data-dutchie data-category="${esc(cur)}" data-state="loading" data-script-src="${esc(E.scriptSrc)}" data-store-path="${esc(E.storePath)}" data-slugs="${esc(slugs)}"${readParam ? ' data-url-category' : ''}>
    <p class="menu-slot__status" data-dutchie-status role="status"><span class="menu-slot__dot" aria-hidden="true"></span>${esc(E.loading)}</p>
    <div class="menu-skel" aria-hidden="true"><span class="menu-skel__bar"></span><span class="menu-skel__grid">${skelCards}</span></div>
    <div class="menu-fallback" data-dutchie-fallback><a class="btn btn--primary btn--lg" href="${esc(E.fallbackHref)}" target="_blank" rel="noopener">${icon('external')}${esc(E.fallback)}</a></div>
    <div class="dutchie-embed-wrapper menu-mount" data-dutchie-mount></div>
   </div>
  </div>
 </div>
</section>`;
}
