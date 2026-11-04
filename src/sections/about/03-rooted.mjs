// 03-rooted — the founding story (live home "Rooted in Irvington" copy) beside the site's live stats as big callouts.
// A trailing "+" or "★" is set in its own span (.stat__suf): solid, smaller, raised. On an outlined number the variable
// font's "+" draws its overlapping contours as a boxed grid, so only the digits are outlined. Text is unchanged.
import { esc } from '../../lib/h.mjs';
import { twoLine } from '../../lib/parts.mjs';
export const meta = { order: 3, id: 'rooted' };

const num = (t) => { const m = /^(.*?)([+★])$/u.exec(t); return m ? `${esc(m[1])}<span class="stat__suf">${esc(m[2])}</span>` : esc(t); };

export function render({ content: C }) {
  const R = C.rooted;
  const stats = R.stats.map((s, n) => `<li class="stat rooted__stat" style="--i:${n}" data-reveal><span class="stat__num${n % 2 ? ' stat__num--outline' : ''}">${num(s.num)}</span> <span class="stat__label">${esc(s.label)}</span></li>`).join('');
  return `<section class="rooted pool pool--warm" id="rooted" aria-labelledby="rooted-title">
 <div class="container">
  <div class="rooted__panel glass glass--lit">
   <div class="rooted__copy" data-reveal>
    <h2 id="rooted-title">${twoLine(R.title, R.titleAccent)}</h2>
    <p>${esc(R.text)}</p>
   </div>
   <ul class="rooted__stats" role="list">${stats}</ul>
  </div>
 </div>
</section>`;
}
