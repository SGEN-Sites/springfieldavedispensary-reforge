// 09-rooted — "Our Story" / "Rooted in Irvington": the story teaser + Read Our Full Story (-> About), and a glass bento of the
// four live stats beside the real store-interior photo (the only Springfield photo; 382 x 510, shown no larger than that).
// The 4.8★ stat is the live wording; no review source is added (none is given live).
import { esc, img } from '../../lib/h.mjs';
import { twoLine } from '../../lib/parts.mjs';
export const meta = { order: 9, id: 'rooted' };

export function render({ content: C, link }) {
  const R = C.rooted;
  const stats = R.stats.map((s, i) => `<li class="rooted__stat rooted__stat--${i + 1} glass stat" style="--i:${i + 1}" data-reveal>
     <span class="stat__num${i === 0 ? ' stat__num--outline' : ''}">${esc(s.num)}</span>
     <span class="stat__label">${esc(s.label)}</span>
    </li>`).join('');
  return `<section class="rooted pool pool--warm" id="our-story" aria-labelledby="rooted-title">
 <span class="ghost-word rooted__ghost" aria-hidden="true">${esc(R.titleAccent)}</span>
 <div class="container rooted__grid">
  <div class="rooted__copy" data-reveal>
   <p class="eyebrow">${esc(R.eyebrow)}</p>
   <h2 id="rooted-title">${twoLine(R.title, R.titleAccent)}</h2>
   <p class="rooted__text">${esc(R.text)}</p>
   <a class="btn btn--ghost btn--lg" href="${link(R.cta.href)}">${esc(R.cta.text)}</a>
  </div>
  <div class="rooted__bento">
   <figure class="frame rooted__photo" data-reveal>${img('interior', { link, alt: R.photoAlt })}</figure>
   <ul class="rooted__stats" role="list">${stats}</ul>
  </div>
 </div>
</section>`;
}
