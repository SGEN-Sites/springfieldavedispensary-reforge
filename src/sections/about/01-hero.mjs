// 01-hero — compact page hero ("Our Story") over the blurred store interior (the live About hero uses the same photo),
// with three live facts as glass chips.
import { esc, icon } from '../../lib/h.mjs';
import { pageHero } from '../../lib/parts.mjs';
export const meta = { order: 1, id: 'hero' };

export function render({ content: C }) {
  const H = C.hero;
  const facts = `<ul class="about-facts" role="list">${H.facts.map((f, n) => `<li class="chip about-fact" style="--i:${n + 1}" data-reveal>${icon(f.icon)}<span>${esc(f.text)}</span></li>`).join('')}</ul>`;
  return pageHero({ eyebrow: H.eyebrow, title: H.title, accent: H.titleAccent, lede: H.lede, meta: facts, ghost: H.ghost, id: 'page-title' });
}
