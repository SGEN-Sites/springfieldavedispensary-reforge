// 03-featured — the live Featured Deals offers: bulk tiers (The More You Grab, The More You Save), First Visit
// (F1 "New to Treehouse?" kept verbatim, flagged) and Bring a Friend. >= 1100px: three columns (bulk a little wider, its
// tier ladder in three columns, the flower cut-out floating inside the card beside its call). Below: a swipe rail (the
// cut-out steps back). The two shorter cards share the row height evenly: their middle part sits centred.
import { esc } from '../../../lib/h.mjs';
import { sectionHead, railControls, twoLine } from '../../../lib/parts.mjs';
import { float } from '../common.mjs';
export const meta = { order: 3, id: 'featured' };

const badges = (list, first = '') => `<div class="dl-badges">${list.map((b, i) => `<span class="badge${i === 0 && first ? ' ' + first : ''}">${esc(b)}</span>`).join('')}</div>`;

export function render({ content: C, link }) {
  const F = C.featured, B = F.bulk, V = F.firstVisit, R = F.friend;
  const bulk = `<li class="dl-feat__item dl-feat__item--bulk" data-reveal>
   <article class="dl-offer dl-offer--bulk glass glass--lit card" aria-labelledby="dl-bulk-title">
    ${badges([B.badge], 'badge--live')}
    <h3 class="dl-offer__title t-break" id="dl-bulk-title">${twoLine(B.title, B.titleAccent)}</h3>
    <p class="dl-offer__text">${esc(B.text)}</p>
    <ul class="dl-tiers" role="list">${B.tiers.map((t) => `<li class="dl-tier glass glass--flat"><span class="dl-tier__pct">${esc(t.pct)}</span><span class="dl-tier__off">${esc(B.offWord)}</span><span class="dl-tier__qty">${esc(t.qty)}</span><span class="dl-tier__wt">${esc(t.weight)}</span></li>`).join('')}</ul>
    <div class="dl-bulk__foot"><a class="btn btn--primary dl-offer__cta" href="${link(B.cta.href)}">${esc(B.cta.text)}</a>${float('cut-flower-280', { link, cls: 'dl-bulk__bud', ft: 10, r0: -3, r1: 3 })}</div>
   </article>
  </li>`;
  const first = `<li class="dl-feat__item" style="--i:1" data-reveal>
   <article class="dl-offer glass card card--hover" aria-labelledby="dl-first-title">
    ${badges([V.badge], 'badge--live')}
    <div class="dl-first">
     <div>
      <h3 class="dl-offer__title t-break" id="dl-first-title">${twoLine(V.title, V.titleAccent)}</h3>
      <p class="dl-offer__text">${esc(V.text)}</p>
     </div>
     <p class="stat dl-first__stat"><span class="stat__num stat__num--outline">${esc(V.stat.num)}</span><span class="stat__label">${esc(V.stat.label)}</span></p>
    </div>
    <div class="dl-offer__foot"><ul class="cluster dl-points" role="list">${V.points.map((p) => `<li class="chip">${esc(p)}</li>`).join('')}</ul><a class="link-arrow" href="${link(V.cta.href)}">${esc(V.cta.text)}</a></div>
   </article>
  </li>`;
  const friend = `<li class="dl-feat__item" style="--i:2" data-reveal>
   <article class="dl-offer glass card card--hover" aria-labelledby="dl-friend-title">
    ${badges(R.badges, 'badge--live')}
    <h3 class="dl-offer__title t-break" id="dl-friend-title">${twoLine(R.title, R.titleAccent)}</h3>
    <p class="dl-offer__text">${esc(R.text)}</p>
    <ul class="dl-people" role="list">${R.people.map((p) => `<li><span class="dl-people__disc" aria-hidden="true">${esc(p.initial)}</span><span><b>${esc(p.who)}</b><span>${esc(p.line)}</span></span></li>`).join('')}</ul>
    <div class="dl-offer__foot"><p class="fine">${esc(R.terms)}</p><a class="link-arrow" href="${link(R.cta.href)}">${esc(R.cta.text)}</a></div>
   </article>
  </li>`;
  return `<section class="dl-feat pool pool--warm" aria-labelledby="dl-feat-title">
 <div class="container">
  ${sectionHead({ eyebrow: F.eyebrow, title: F.title, accent: F.titleAccent, link, id: 'dl-feat-title' })}
  <div class="carousel" data-carousel>
   <ul class="rail rail--bleed dl-feat__rail" data-rail role="list">${bulk}${first}${friend}</ul>
   <div class="dl-feat__controls">${railControls()}</div>
  </div>
 </div>
</section>`;
}
