// 05-visit — the closing call: "Come Say High", Visit Us Today (-> Contact) + directions, address and hours (shared NAP).
import { esc, icon, particles } from '../../lib/h.mjs';
import { withAccent } from '../../lib/parts.mjs';
export const meta = { order: 5, id: 'visit' };

export function render({ content: C, S, link }) {
  const V = C.visit;
  // the address may break only after "Suite C," (street, then the city line kept whole); the words are the shared NAP
  if (S.address.oneLine !== `${S.address.street}, ${S.address.cityLine}`) throw new Error('visit: address parts do not make oneLine');
  const addr = `${esc(S.address.street)}, <span class="nowrap">${esc(S.address.cityLine)}</span>`;
  return `<section class="visit" id="visit" aria-labelledby="visit-title">
 <div class="container">
  <div class="visit__panel glass glass--lit">
   ${particles(14)}
   <div class="visit__in" data-reveal>
    <p class="eyebrow eyebrow--center">${esc(V.eyebrow)}</p>
    <h2 id="visit-title">${withAccent(V.title, V.titleAccent)}</h2>
    <p class="lede">${esc(V.text)}</p>
    <div class="visit__actions">
     <a class="btn btn--primary btn--lg" href="${link(V.cta.href)}">${esc(V.cta.text)}</a>
     <a class="btn btn--ghost btn--lg" href="${esc(S.directionsHref)}" target="_blank" rel="noopener">${icon('map')}${esc(S.dock.directions)}</a>
    </div>
    <div class="visit__info">
     <p class="info">${icon('pin')}<span>${addr}</span></p>
     <p class="info">${icon('clock')}<span>${S.footer.hours.map((h) => `<span class="nowrap">${esc(h)}</span>`).join(' · ')}</span></p>
    </div>
   </div>
  </div>
 </div>
</section>`;
}
