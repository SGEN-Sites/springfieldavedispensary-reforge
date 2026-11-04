// 02-how — the live How It Works heading + paragraph in one compact lit band (same part as the bundles page): the
// heading is the band's small label, the paragraph its statement.
import { esc } from '../../../lib/h.mjs';
export const meta = { order: 2, id: 'how' };

export function render({ content: C }) {
  const Hw = C.how;
  return `<section class="ly-how sec--tight" aria-labelledby="ly-how-title">
 <div class="container">
  <div class="vh-band glass glass--lit pad-lg" data-reveal>
   <h2 class="eyebrow vh-band__label" id="ly-how-title">${esc(Hw.title)}</h2>
   <p class="vh-band__text">${esc(Hw.text)}</p>
  </div>
 </div>
</section>`;
}
