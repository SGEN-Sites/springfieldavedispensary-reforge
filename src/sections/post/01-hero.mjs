// 01-hero — parts.pageHero (compact) with the live order: "← Back to Dispatch", category + date, then the h1.
// The back link + meta row go in pageHero's `before` slot (ahead of the h1). keepCompounds keeps a hyphenated title word
// ("Clean-Up") on one line; it only touches text, so it does not depend on pageHero's markup. An owner-supplied post's
// one-line summary (dek) follows the h1 as the lede; the live posts have none.
import { esc } from '../../lib/h.mjs';
import { pageHero } from '../../lib/parts.mjs';
import { keepCompounds, postMeta } from '../blog/cards.mjs';
export const meta = { order: 1, id: 'hero' };

export function render({ content: C, link }) {
  const before = `<a class="post-back" href="${link(C.back.href)}">${esc(C.back.text)}</a>
  <p class="post-hero__meta">${postMeta({ catLabel: C.catLabel, date: C.date })}</p>
  `;
  return keepCompounds(pageHero({ title: C.title.text, accent: C.title.accent, id: 'page-title', variant: 'post', before, lede: C.dek || '' }));
}
