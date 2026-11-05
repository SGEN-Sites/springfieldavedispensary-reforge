// cards.mjs — lane blog: the article card, the meta row and small text helpers shared by the listing (blog) and the
// post template (post). Not a section (no meta/render): blog.mjs and post.mjs import it.
import { esc, img } from '../../lib/h.mjs';

const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
/** "Nov 02, 2025" -> "2025-11-02" (the live date format); throws on anything else so a bad date never ships silently. */
export function isoDate(d) {
  const m = /^([A-Z][a-z]{2}) (\d{2}), (\d{4})$/.exec(d);
  if (!m || !MONTHS[m[1]]) throw new Error(`blog: unexpected date "${d}"`);
  return `${m[3]}-${MONTHS[m[1]]}-${m[2]}`;
}

/** A live "Label →" string: the words, then the arrow as its own (decorative) span so CSS can colour and nudge it. */
export function arrowText(s) {
  const m = /^(.*?)\s*→$/.exec(s);
  return m ? `${esc(m[1])} <span class="arr" aria-hidden="true">→</span>` : esc(s);
}

/** Keep hyphenated compounds whole in titles ("Clean-Up" never ends a line as "Clean-"): every word containing a hyphen,
 *  in the TEXT of an already-escaped HTML string (tags and attributes untouched), goes in <span class="nowrap"> (base.css).
 *  The text content is unchanged, so prove-content / parity read the same words. */
export function keepCompounds(html) {
  return html.split(/(<[^>]*>)/).map((part, i) => (i % 2 ? part : part.replace(/[^\s<>]*[^\s<>-]-[^\s<>]*[^\s<>-][^\s<>]*/g, (w) => `<span class="nowrap">${w}</span>`))).join('');
}

/** The image keys of one picture in its three widths (images.json: <stem>-480/960/1408). */
export const picture = (stem) => [`${stem}-480`, `${stem}-960`, `${stem}-1408`];

/** Category badge + date. */
export function postMeta({ catLabel, date, badgeCls = '' }) {
  return `<span class="post-meta"><span class="badge${badgeCls ? ' ' + badgeCls : ''}">${esc(catLabel)}</span><time class="post-meta__date" datetime="${isoDate(date)}">${esc(date)}</time></span>`;
}

/** A drawn cover for a post with no photograph (the owner-supplied posts, 2026-11-05): the brand's street-sign plate
 *  carrying the category, the post's key word set large in the accent face, one glow (emerald for Education, warm for
 *  Recipes) whose position follows the word, so a grid of covers is not a wall of copies. Deterministic (no randomness:
 *  builds stay byte-reproducible). Decorative: the card title and the h1 carry the same words. */
export function coverArt(cv, label, { hero = false } = {}) {
  let h = 0;
  for (const ch of String(cv.word)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const gx = 18 + (h % 64), gy = 16 + ((h >>> 7) % 52), len = [...String(cv.word)].length;
  return `<span class="cover cover--${esc(cv.tone)}${hero ? ' cover--hero' : ''}" style="--gx:${gx}%;--gy:${gy}%;--len:${len}" aria-hidden="true"><span class="cover__plate">${esc(label)}</span><span class="cover__word">${esc(cv.word)}</span></span>`;
}

/** One article card (a glass link). compact = the post page's "More from Dispatch" card (live: category + title only). */
export function postCard(p, { link, readMore, compact = false, sizes }) {
  const meta = compact
    ? `<span class="post-meta"><span class="badge">${esc(p.catLabel)}</span></span>`
    : postMeta(p);
  const media = p.cover ? coverArt(p.cover, p.catLabel) : img(picture(p.imageKey), { link, decorative: true, sizes });
  return `<a class="post-card glass card card--link${compact ? ' post-card--compact' : ''}" href="${link(p.href)}">
    <div class="post-card__media">${media}</div>
    <div class="post-card__body">
     ${meta}
     <h3 class="post-card__title">${keepCompounds(esc(p.title))}</h3>
     ${compact ? '' : `<p class="post-card__excerpt">${esc(p.excerpt)}</p>
     <span class="post-card__more">${arrowText(readMore)}</span>`}
    </div>
   </a>`;
}
