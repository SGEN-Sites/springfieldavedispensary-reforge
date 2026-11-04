// 04-more — the two live "coming soon" programmes as teasers that link to their pages (F2: kept as live).
import { esc } from '../../../lib/h.mjs';
import { railControls, twoLine } from '../../../lib/parts.mjs';
export const meta = { order: 4, id: 'more' };

export function render({ content: C, link }) {
  const Bn = C.more.bundles, Ly = C.more.loyalty;
  const card = (id, badgesList, title, accent, text, tiers, cta, n) => `<li class="dl-more__item" style="--i:${n}" data-reveal>
   <article class="dl-teaser glass card card--hover" aria-labelledby="${id}">
    <div class="dl-badges">${badgesList.map((b, i) => `<span class="badge${i === 0 ? ' badge--soon' : ''}">${esc(b)}</span>`).join('')}</div>
    <h2 class="dl-teaser__title" id="${id}">${twoLine(title, accent)}</h2>
    <p class="dl-offer__text">${esc(text)}</p>
    <ul class="dl-teaser__tiers" role="list">${tiers}</ul>
    <a class="btn btn--ghost dl-teaser__cta" href="${link(cta.href)}">${esc(cta.text)}</a>
   </article>
  </li>`;
  const bt = Bn.tiers.map((t) => `<li><span class="dl-teaser__price">${esc(t.price)}</span><b>${esc(t.name)}</b><span>${esc(t.line)}</span></li>`).join('');
  const lt = Ly.tiers.map((t, i) => `<li><span class="dl-teaser__pips" aria-hidden="true">${'<i></i>'.repeat(i + 1)}</span><b>${esc(t.name)}</b><span>${esc(t.line)}</span></li>`).join('');
  return `<section class="dl-more sec--tight pool">
 <div class="container">
  <div class="carousel" data-carousel>
   <ul class="rail rail--bleed dl-more__rail" data-rail role="list">
    ${card('dl-bundles-title', Bn.badges, Bn.title, Bn.titleAccent, Bn.text, bt, Bn.cta, 0)}
    ${card('dl-loyalty-title', [Ly.badge], Ly.title, Ly.titleAccent, Ly.text, lt, Ly.cta, 1)}
   </ul>
   <div class="dl-more__controls">${railControls()}</div>
  </div>
 </div>
</section>`;
}
