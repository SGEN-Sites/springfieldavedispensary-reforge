// shop-category.mjs — /shop/<flower|pre-rolls|vaporizers|concentrates|edibles|topicals|accessories>/: the same menu page
// with a breadcrumb, the category's own copy, and the Dutchie embed pointed at /products/<slug>. The filter chips link
// to the other category pages (live behaviour).
// CSS: the menu pages share src/styles/pages/shop/*.css; build.mjs writes it as assets/css/shop.css for this template
// too (cssFrom), so a category-only build is styled.
import { hero } from '../sections/menu/01-hero.mjs';
import { embed } from '../sections/menu/02-embed.mjs';
import { info } from '../sections/menu/03-info.mjs';
import { MENU_HEAD } from '../sections/menu/head.mjs';

export function render(ctx) {
  const main = [hero(ctx), embed(ctx), info(ctx)].join('\n');
  return { main, head: MENU_HEAD, cssFrom: ['shop'], bodyClass: 'is-menu is-menu-cat', scripts: ['assets/js/menu.js'] };
}
