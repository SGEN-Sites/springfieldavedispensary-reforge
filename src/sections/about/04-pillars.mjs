// 04-pillars — the four Core Pillars as a glass bento (7/5 then 5/7 on desktop; the wide cards carry a floating
// product cut-out). Tablet 2 x 2, phones a compact 2-column grid.
import { esc, img, icon } from '../../lib/h.mjs';
import { sectionHead } from '../../lib/parts.mjs';
export const meta = { order: 4, id: 'pillars' };

export function render({ content: C, link }) {
  const P = C.pillars;
  const items = P.items.map((p, n) => `<li class="bento__item bento__item--${n + 1} glass${p._cutKey ? ' glass--lit bento__item--cut' : ''} card card--hover" style="--i:${n}" data-reveal>
   <span class="icon-disc">${icon(p.icon)}</span>
   <h3>${esc(p.title)}</h3>
   <p>${esc(p.text)}</p>
   ${p._cutKey ? `<div class="float bento__cut" style="--ft:${9 + n}s;--fd:-${n * 2}s" aria-hidden="true">${img(p._cutKey, { link, decorative: true })}</div>` : ''}
  </li>`).join('');
  return `<section class="pillars pool" id="pillars" aria-labelledby="pillars-title">
 <div class="container">
  ${sectionHead({ eyebrow: P.eyebrow, title: P.title, accent: P.titleAccent, link, id: 'pillars-title' })}
  <ul class="bento" role="list">${items}</ul>
 </div>
</section>`;
}
