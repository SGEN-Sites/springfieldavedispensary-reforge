// 04-bulk — "The More You Grab, The More You Save": the contrast-shift band. A lit glass panel; the three tiers are big stat
// callouts on an ascending ladder (the more you grab, the taller the step), each % with the live "off" word, qty + weight.
import { esc } from '../../lib/h.mjs';
import { twoLine } from '../../lib/parts.mjs';
export const meta = { order: 4, id: 'bulk' };

export function render({ content: C, link }) {
  const B = C.featured.bulk;
  const n = B.tiers.length;
  const tiers = B.tiers.map((t, i) => `<li class="bulk__tier${i === n - 1 ? ' bulk__tier--top' : ''}" style="--i:${i + 1};--step:${i}" data-reveal>
     <p class="bulk__save"><span class="stat__num${i === n - 1 ? ' stat__num--outline' : ''}">${esc(t.pct)}</span> <span class="bulk__off">${esc(B.offWord)}</span></p>
     <p class="bulk__qty">${esc(t.qty)}</p>
     <p class="bulk__wt">${esc(t.weight)}</p>
    </li>`).join('');
  return `<section class="bulk pool pool--breathe" id="bulk-savings" aria-labelledby="bulk-title">
 <div class="container">
  <div class="bulk__panel glass glass--lit" data-reveal>
   <div class="bulk__copy">
    <p class="bulk__badge"><span class="badge badge--live">${esc(B.badge)}</span></p>
    <h2 id="bulk-title">${twoLine(B.title, B.titleAccent)}</h2>
    <p class="lede bulk__text">${esc(B.text)}</p>
    <a class="btn btn--primary btn--lg" href="${link(B.cta.href)}">${esc(B.cta.text)}</a>
   </div>
   <ol class="bulk__tiers" role="list">${tiers}</ol>
  </div>
 </div>
</section>`;
}
