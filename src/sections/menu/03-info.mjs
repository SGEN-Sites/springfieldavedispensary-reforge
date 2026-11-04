// 03-info — the live SEO block (h2 + paragraph) beside the "Order Info" box. Compact: one row on desktop, stacked on phones.
// The live shop page marks this heading h3 straight after the h1; it is an h2 here (no skipped heading levels).
import { esc, icon } from '../../lib/h.mjs';
import { withAccent } from '../../lib/parts.mjs';

export function info({ content: C }) {
  const S = C.seo, O = C.order;
  const strong = new Set(O._strong || []);
  const body = O.bodyParts.map((t, i) => (strong.has(i) ? `<strong>${esc(t)}</strong>` : esc(t))).join(' ');
  return `<section class="menu-info pool" aria-labelledby="menu-info-title">
 <div class="container menu-info__grid">
  <div class="menu-info__seo" data-reveal>
   <h2 id="menu-info-title" class="menu-info__title">${withAccent(S.title, S.titleAccent)}</h2>
   <p>${esc(S.body)}</p>
  </div>
  <div class="menu-info__order glass glass--lit" data-reveal style="--i:1">
   <span class="icon-disc">${icon('bag')}</span>
   <div>
    <h3 class="menu-info__label">${esc(O.label)}</h3>
    <p>${body}</p>
   </div>
  </div>
 </div>
</section>`;
}
