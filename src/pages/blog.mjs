// blog.mjs — the /blog listing (lane blog): hero, featured post, filtered article cards. Sections in src/sections/blog/.
import * as hero from '../sections/blog/01-hero.mjs';
import * as featured from '../sections/blog/02-featured.mjs';
import * as posts from '../sections/blog/03-posts.mjs';

export function render(ctx) {
  if (!ctx.content) throw new Error('blog: src/content/pages/blog.json is missing');
  const main = [hero, featured, posts].sort((a, b) => a.meta.order - b.meta.order).map((m) => m.render(ctx)).join('\n');
  return { main, scripts: ['assets/js/blog.js'] };
}
