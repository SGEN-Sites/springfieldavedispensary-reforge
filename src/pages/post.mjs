// post.mjs — one blog article (lane blog; the 5 live posts). Content: src/content/pages/blog-<slug>.json.
import * as hero from '../sections/post/01-hero.mjs';
import * as article from '../sections/post/02-article.mjs';
import * as related from '../sections/post/03-related.mjs';

export function render(ctx) {
  if (!ctx.content || !Array.isArray(ctx.content.body)) throw new Error(`post: no content model for ${ctx.page.id} (src/content/pages/${ctx.page.id}.json)`);
  const main = [hero, article, related].sort((a, b) => a.meta.order - b.meta.order).map((m) => m.render(ctx)).join('\n');
  return { main };
}
