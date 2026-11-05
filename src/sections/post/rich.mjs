// rich.mjs — lane blog: the owner-supplied posts' body and article extras (added 2026-11-05). Not a section (no
// meta/render): 02-article.mjs imports it. The content model (src/content/pages/blog-<slug>.json, written by the local
// import converter) is plain data: runs of text (a string, or {text, href?, b?, i?}), blocks {kind: p | h2 | h3 | ul | ol
// | table | quote | callout}, plus takeaways / toc / recipe / faq / sources / note. Every string is escaped here; an
// internal href goes through link(), an external one opens in a new tab (noopener), "#id" stays on the page.
import { esc } from '../../lib/h.mjs';

const isExternal = (h) => /^(https?:)?\/\//i.test(h);
const anchor = (href, inner, link) => (href.startsWith('#')
  ? `<a href="${esc(href)}">${inner}</a>`
  : isExternal(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<a href="${link(href)}">${inner}</a>`);

/** Inline runs -> HTML. */
export function runsHtml(runs, link) {
  return (runs || []).map((r) => {
    if (typeof r === 'string') return esc(r);
    let t = esc(r.text);
    if (r.i) t = `<em>${t}</em>`;
    if (r.b) t = `<strong>${t}</strong>`;
    return r.href ? anchor(r.href, t, link) : t;
  }).join('');
}

/** Body blocks -> HTML (a heading keeps the source id, so "In this article" links land on it). ctx is shared by every
 *  call on one page so the table boxes get page-unique names. */
export function blocksHtml(blocks, link, ctx = { tables: 0 }) {
  return (blocks || []).map((b) => {
    switch (b.kind) {
      case 'p': return `<p>${runsHtml(b.runs, link)}</p>`;
      case 'h2': case 'h3': return `<${b.kind}${b.id ? ` id="${esc(b.id)}"` : ''}>${esc(b.text)}</${b.kind}>`;
      case 'ul': case 'ol': return `<${b.kind}>${b.items.map((it) => `<li>${runsHtml(it.runs, link)}</li>`).join('')}</${b.kind}>`;
      // a table lives in its own horizontally scrollable box, so a wide one never widens the page on a phone; the box is
      // keyboard-focusable and named by its number + column headings (a scrollable region must be reachable without a
      // mouse; two regions on a page may not share a name). An empty header cell (a row-label corner) is a plain cell.
      case 'table': {
        ctx.tables += 1;
        const cols = (b.head && b.head.length ? b.head : b.rows[0] || []).filter(Boolean).join(', ');
        const head = b.head && b.head.length ? `<thead><tr>${b.head.map((c) => (c ? `<th scope="col">${esc(c)}</th>` : '<td></td>')).join('')}</tr></thead>` : '';
        return `<div class="post-table" tabindex="0" role="region" aria-label="${esc(`Table ${ctx.tables}: ${cols}`)}"><table>${head}<tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      case 'quote': return `<blockquote><p>${runsHtml(b.runs, link)}</p></blockquote>`;
      case 'callout': return callout(b, link, ctx);
      default: throw new Error(`post: unknown block kind "${b.kind}"`);
    }
  }).join('\n   ');
}

// callouts, takeaways and the 21+ note are boxes INSIDE the article, not landmarks of their own (an <aside> nested in
// the article section is a complementary landmark that is not top-level: axe, 2026-11-05)
function callout(b, link, ctx) {
  return `<div class="post-callout${b.tone ? ' post-callout--' + esc(b.tone) : ''}">${b.title ? `<p class="post-callout__title">${esc(b.title)}</p>` : ''}${blocksHtml(b.blocks, link, ctx)}</div>`;
}

/** "Key takeaways": a lit glass box ahead of the body. */
export function takeaways(T, link) {
  return `<div class="post-takeaways glass glass--lit">
   <h2 class="post-box__title">${esc(T.title)}</h2>
   <ul class="post-takeaways__list">${T.items.map((it) => `<li>${runsHtml(it.runs, link)}</li>`).join('')}</ul>
  </div>`;
}

/** "In this article": a native accordion (closed by default) of the page's own headings. */
export function toc(T) {
  return `<nav class="post-toc" aria-label="${esc(T.title)}">
   <details class="acc glass post-toc__box"><summary>${esc(T.title)}</summary>
    <div class="acc__body"><ol class="post-toc__list">${T.items.map((it) => `<li><a href="${esc(it.href)}">${esc(it.text)}</a></li>`).join('')}</ol></div>
   </details>
  </nav>`;
}

/** The recipe card: facts (makes / prep / cook), ingredients + steps, the dosing note. id="recipe" for "Jump to". */
export function recipe(Rc, link, ctx = { tables: 0 }) {
  return `<section class="post-recipe glass" id="recipe">
   <h2 class="post-recipe__title">${esc(Rc.title)}</h2>
   ${Rc.facts && Rc.facts.length ? `<dl class="post-recipe__facts">${Rc.facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>` : ''}
   ${(Rc.sections || []).map((s) => `<div class="post-recipe__part">${s.title ? `<h3>${esc(s.title)}</h3>` : ''}${blocksHtml(s.blocks, link, ctx)}</div>`).join('\n   ')}
   ${Rc.note ? callout(Rc.note, link, ctx) : ''}
  </section>`;
}

/** FAQ: native accordions (the same .acc component as the Contact page). */
export function faq(F, link, ctx = { tables: 0 }) {
  return `<section class="post-faq" id="faq">
   <h2 class="post-faq__title">${esc(F.title)}</h2>
   ${F.items.map((it) => `<details class="acc glass"><summary>${esc(it.q)}</summary><div class="acc__body">${blocksHtml(it.a, link, ctx)}</div></details>`).join('\n   ')}
  </section>`;
}

/** Sources: the article's citations, each opening in a new tab. */
export function sources(So) {
  return `<section class="post-sources" id="sources">
   <h2 class="post-sources__title">${esc(So.title)}</h2>
   <ol class="post-sources__list">${So.items.map((s) => {
     const inner = `<cite>${esc(s.label)}</cite>${s.host ? ` <span class="post-sources__host">${esc(s.host)}</span>` : ''}`;
     return `<li>${s.href ? `<a href="${esc(s.href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner}</li>`;
   }).join('')}</ol>
  </section>`;
}

/** The 21+ note. */
export function note(N) {
  return `<div class="post-note glass glass--flat" role="note">${N.badge ? `<span class="badge">${esc(N.badge)}</span>` : ''}<p>${esc(N.text)}</p></div>`;
}
