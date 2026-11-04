// 01-hero — "Loyalty That Levels Up": the live Coming Soon badge and intro; (desktop) a decorative fan of three glass
// member cards rising in light (no text, aria-hidden).
import { esc, img } from '../../../lib/h.mjs';
import { pageHero } from '../../../lib/parts.mjs';
import { intoHero, ctaPair } from '../common.mjs';
export const meta = { order: 1, id: 'hero' };

export function render({ content: C, link }) {
  const H = C.hero;
  const badges = `<div class="vh-badges"><span class="badge badge--soon">${esc(H.badge)}</span></div>`;
  // the live Program Launching Soon pair (Visit Us + Shop Now) repeated in the hero, so the first screen has an action
  const hero = pageHero({ before: badges, title: H.title, accent: H.titleAccent, lede: H.lede, actions: ctaPair(C.launch.primary, C.launch.secondary, link) });
  const card = (n) => `<span class="float ly-art__card ly-art__card--${n}" style="--ft:${8 + n * 1.5}s;--fd:${-n * 2}s;--fr0:${[-12, -4, 5][n - 1]}deg;--fr1:${[-9, -1, 8][n - 1]}deg"><span class="ly-art__pips">${'<i></i>'.repeat(n)}</span>${n === 3 ? `<span class="seal ly-art__seal">${img('logo-96', { link, decorative: true })}</span>` : ''}</span>`;
  return intoHero(hero, `<div class="vh-stage ly-art" aria-hidden="true"><span class="vh-stage__halo"></span>${card(1)}${card(2)}${card(3)}</div>`);
}
