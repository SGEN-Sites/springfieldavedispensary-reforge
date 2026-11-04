// 01-hero — the compact inner-page hero (parts.pageHero): "Dispatch" (accented), the live lede, an outlined ghost word.
import { pageHero } from '../../lib/parts.mjs';
export const meta = { order: 1, id: 'hero' };

export function render({ content: C }) {
  const H = C.hero;
  return pageHero({ eyebrow: H.eyebrow, title: H.title.text, accent: H.title.accent, lede: H.lede, ghost: H.ghost, id: 'page-title' });
}
