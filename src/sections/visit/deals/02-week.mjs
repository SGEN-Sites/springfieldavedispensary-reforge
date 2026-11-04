// 02-week — the seven weekly specials with their FULL detail and terms visible. Each card is also the opener of its
// dialog#deal-<day> (BUILD-CONTRACT §4, the live modal: day, name, offer, detail, Shop Now, terms — parts.dealDialog, the
// same dialog the homepage uses): one transparent button covers the card, named by the deal's heading, so a click
// anywhere on a card opens it, as on the homepage. Today is lit via [data-day] (site.js sets [data-today]).
// >= 1100 wide AND >= 860 tall: a 4 x 2 grid (the eighth cell is the live "Ready to order?" call). Otherwise: a swipe
// rail that starts at today (full-bleed below 1100px).
import { esc, icon } from '../../../lib/h.mjs';
import { railControls, dealDialog } from '../../../lib/parts.mjs';
export const meta = { order: 2, id: 'week' };

export function render({ content: C, link }) {
  const W = C.weekly, H = C.hero;
  const cards = W.days.map((d, n) => {
    const id = `deal-${d.dayIndex}`, h = `dl-day-${d.dayIndex}`;
    return `<li class="day dl-day" data-day="${d.dayIndex}" style="--i:${n}" data-reveal>
   <article class="dl-card glass card card--hover" aria-labelledby="${h}">
    <div class="dl-card__top"><span class="dl-card__day">${esc(d.day)}</span><span class="badge badge--accent" data-today-badge hidden>${esc(H.todayBadge)}</span></div>
    <h2 class="dl-card__name" id="${h}" data-deal-name>${esc(d.name)}</h2>
    <p class="dl-card__offer" id="${h}-offer">${esc(d.offer)}</p>
    <p class="dl-card__detail">${esc(d.detail)}</p>
    <p class="dl-card__terms">${esc(d.terms)}</p>
    <button type="button" class="dl-card__open" data-dialog="${id}" aria-haspopup="dialog" aria-labelledby="${h}" aria-describedby="${h}-offer"></button>
   </article>
   ${dealDialog(d, { shop: W.dealShop, link, id })}
  </li>`;
  }).join('');
  const R = W.ready;
  const ready = `<li class="dl-day dl-day--cta" style="--i:7" data-reveal>
   <div class="dl-ready glass glass--lit">
    <span class="icon-disc">${icon('bag')}</span>
    <h2 class="dl-ready__title">${esc(R.title)}</h2>
    <p>${esc(R.text)}</p>
    <a class="btn btn--primary" href="${link(R.cta.href)}">${esc(R.cta.text)}</a>
   </div>
  </li>`;
  return `<section class="dl-week pool" id="week">
 <div class="container">
  <div class="carousel dl-week__carousel" data-carousel>
   <ul class="rail rail--bleed dl-week__rail" data-rail data-today-scroll role="list">${cards}${ready}</ul>
   <div class="dl-week__controls">${railControls()}</div>
  </div>
 </div>
</section>`;
}
