// 04-enroll — How to Enroll: the two live steps (01 in person, 02 via Dutchie, with the live dutchie.com link).
import { esc, icon } from '../../../lib/h.mjs';
import { sectionHead } from '../../../lib/parts.mjs';
export const meta = { order: 4, id: 'enroll' };

export function render({ content: C, link }) {
  const E = C.enroll;
  const steps = E.steps.map((s, n) => `<li class="ly-step glass card card--hover" style="--i:${n}" data-reveal>
    <div class="ly-step__top"><span class="ly-step__num">${esc(s.num)}</span><span class="icon-disc">${icon(s._icon)}</span></div>
    <h3>${esc(s.title)}</h3>
    <p>${esc(s.text)}${s.link ? ` <a href="${esc(s.link.href)}" target="_blank" rel="noopener">${esc(s.link.text)}</a> ${esc(s.after)}` : ''}</p>
   </li>`).join('');
  return `<section class="ly-enroll pool pool--warm" aria-labelledby="ly-enroll-title">
 <div class="container">
  ${sectionHead({ eyebrow: E.eyebrow, title: E.title, accent: E.titleAccent, link, id: 'ly-enroll-title' })}
  <ol class="ly-steps" role="list">${steps}</ol>
 </div>
</section>`;
}
