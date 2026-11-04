// 02-mission — editorial split: the h2 as a label, the mission's first paragraph with its FIRST sentence as the display
// pull-line (one accent) and the rest of that same paragraph as a lede under it (same <p>, words unchanged), the body
// at reading measure, the "Dispensary near me?" note as a glass callout, and the ONE real store photo framed in soft
// emerald light. No people (none exist for Springfield, F6).
import { esc, img, icon, accent } from '../../lib/h.mjs';
export const meta = { order: 2, id: 'mission' };

/** Split the live lead paragraph after its first sentence; the accent word must sit in that first sentence. */
function splitLead(lead) {
  const cut = lead.text.indexOf('. ');
  if (cut < 0) throw new Error('mission lead: no sentence break');
  const first = lead.text.slice(0, cut + 1); const rest = lead.text.slice(cut + 2);
  if (lead.accent && !first.includes(lead.accent)) throw new Error('mission lead: accent not in the first sentence');
  return { first: { text: first, accent: lead.accent }, rest };
}

export function render({ content: C, S, link }) {
  const M = C.mission;
  const L = splitLead(M.lead);
  return `<section class="mission pool" id="mission" aria-labelledby="mission-title">
 <div class="container mission__grid">
  <h2 class="eyebrow mission__label" id="mission-title" data-reveal>${esc(M.title)}</h2>
  <p class="mission__lead" style="--i:1" data-reveal><span class="mission__pull">${accent(L.first)}</span> <span class="mission__lead-rest">${esc(L.rest)}</span></p>
  <div class="mission__photo" style="--i:2" data-reveal>
   <div class="frame mission__frame">${img('interior', { link })}</div>
   <p class="mission__cap glass glass--strong"><span class="seal" style="--seal:40px">${img('logo-96', { link, decorative: true })}</span><span class="mission__cap-t"><b>${esc(S.brand.name)}</b> <span>${esc(S.address.cityLine)}</span></span></p>
   <div class="float mission__bud" style="--ft:10s;--fr0:-4deg;--fr1:2deg" aria-hidden="true">${img('cut-flower-280', { link, decorative: true })}</div>
  </div>
  <div class="mission__body" style="--i:3" data-reveal>
   <p>${esc(M.body)}</p>
   <p class="mission__near glass glass--flat">${icon('pin')}<span><strong>${esc(M.nearMe.strong)}</strong> ${esc(M.nearMe.text)}</span></p>
  </div>
 </div>
</section>`;
}
