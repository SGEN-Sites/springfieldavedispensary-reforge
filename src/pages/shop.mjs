// shop.mjs — /shop/: the menu. Compact hero, sticky category filters (real links to the category pages, as live), the
// live Dutchie embed (it opens ?dtche[category]=<slug>, the homepage tiles' links, via menu.js), the live SEO + Order
// Info block. Decoration stays light: speed and clarity first.
import { hero } from '../sections/menu/01-hero.mjs';
import { embed } from '../sections/menu/02-embed.mjs';
import { info } from '../sections/menu/03-info.mjs';
import { MENU_HEAD } from '../sections/menu/head.mjs';

export function render(ctx) {
  const main = [hero(ctx), embed(ctx, { readParam: true }), info(ctx)].join('\n');
  return { main, head: MENU_HEAD, bodyClass: 'is-menu', scripts: ['assets/js/menu.js'] };
}
