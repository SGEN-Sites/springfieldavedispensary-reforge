// 03-tiers — Program Tiers: Bronze / Silver / Gold with their live perks; each tier more lit, Gold the most.
// Desktop/tablet: three columns. Phones: a swipe rail.
import { esc } from '../../../lib/h.mjs';
import { sectionHead, railControls } from '../../../lib/parts.mjs';
export const meta = { order: 3, id: 'tiers' };

const LOOK = { 1: 'glass', 2: 'glass glass--lit', 3: 'glass glass--lit ly-tier--gold' };

export function render({ content: C, link }) {
  const T = C.tiers;
  const cards = T.items.map((t, n) => `<li class="ly-item" style="--i:${n}" data-reveal>
   <article class="ly-tier ly-tier--${t._level} ${LOOK[t._level]} card card--hover" aria-labelledby="ly-tier-${n}">
    <div class="ly-tier__head">
     <span class="ly-pips" aria-hidden="true">${'<i></i>'.repeat(t._level)}</span>
     <div><h3 id="ly-tier-${n}">${esc(t.name)}</h3><p class="ly-tier__sub">${esc(t.sub)}</p></div>
    </div>
    <p class="ly-tier__label">${esc(T.perksTitle)}</p>
    <ul role="list">${t.perks.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
   </article>
  </li>`).join('');
  return `<section class="ly-tiers pool" aria-labelledby="ly-tiers-title">
 <div class="container">
  ${sectionHead({ eyebrow: T.eyebrow, title: T.title, accent: T.titleAccent, link, id: 'ly-tiers-title' })}
  <div class="carousel" data-carousel>
   <ul class="rail rail--bleed ly-rail" data-rail role="list">${cards}</ul>
   <div class="ly-controls">${railControls()}</div>
  </div>
 </div>
</section>`;
}
