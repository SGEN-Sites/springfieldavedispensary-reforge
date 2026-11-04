// 04-faq — the live FAQ: four native accordions with the live answers (expanded.json).
import { esc } from '../../../lib/h.mjs';
import { sectionHead } from '../../../lib/parts.mjs';
export const meta = { order: 4, id: 'faq' };

export function render({ content: C, link }) {
  const Q = C.faq;
  return `<section class="ct-faq pool" aria-labelledby="ct-faq-title">
 <div class="container ct-faq__grid">
  ${sectionHead({ eyebrow: Q.eyebrow, title: Q.title, accent: Q.titleAccent, link, id: 'ct-faq-title' })}
  <div class="ct-faq__list">
   ${Q.items.map((it, n) => `<details class="acc glass" data-reveal style="--i:${n}"><summary>${esc(it.q)}</summary><div class="acc__body"><p>${esc(it.a)}</p></div></details>`).join('\n   ')}
  </div>
 </div>
</section>`;
}
