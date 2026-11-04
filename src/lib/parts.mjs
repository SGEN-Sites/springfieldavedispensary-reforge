// parts.mjs — shared page parts every renderer composes (section heads, rail controls, deal cards + dialogs, page heroes).
import { esc, icon, particles } from './h.mjs';

/** Title with one accent word. title: string; accent: substring of title (optional). */
export function withAccent(title, accent) {
  const i = accent ? title.indexOf(accent) : -1;
  if (accent && i < 0) throw new Error(`accent "${accent}" not in "${title}"`);
  return i < 0 ? esc(title) : esc(title.slice(0, i)) + `<span class="accent">${esc(accent)}</span>` + esc(title.slice(i + accent.length));
}
/** Two-line title (live headings break with <br>): lines = [a, b]; accent inside either line. */
export function twoLine(lines, accent) {
  return lines.map((l) => `<span class="line">${accent && l.includes(accent) ? withAccent(l, accent) : esc(l)}</span>`).join(' ');
}

export function sectionHead({ eyebrow, title, accent, action, link, id, lede, center = false, tag = 'h2' }) {
  const t = Array.isArray(title) ? twoLine(title, accent) : withAccent(title, accent);
  return `<div class="sec-head${center ? ' sec-head--center' : ''}" data-reveal>
  <div>${eyebrow ? `<p class="eyebrow${center ? ' eyebrow--center' : ''}">${esc(eyebrow)}</p>` : ''}<${tag} id="${id}">${t}</${tag}>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</div>
  ${action ? `<a class="link-arrow" href="${link(action.href)}">${esc(action.text)}</a>` : ''}
 </div>`;
}

export function railControls() {
  return `<div class="rail-controls"><button type="button" class="rail-btn" data-prev aria-label="Previous">${icon('chevL')}</button><button type="button" class="rail-btn" data-next aria-label="Next">${icon('chevR')}</button></div>`;
}

/** One weekly special: a glass card button that opens its <dialog>. d = { dayIndex, day, name, offer, detail, terms }. */
export function dealCard(d, { todayBadge, shop, link, n = 0, idPrefix = 'deal' }) {
  const id = `${idPrefix}-${d.dayIndex}`;
  return `<li class="day" data-day="${d.dayIndex}" style="--i:${n}" data-reveal>
  <button type="button" class="day-card glass card card--hover" data-dialog="${id}" aria-haspopup="dialog">
   <span class="badge badge--accent day-card__today" data-today-badge hidden>${esc(todayBadge)}</span>
   <span class="day-card__day">${esc(d.day)}</span>
   <span class="day-card__name" data-deal-name>${esc(d.name)}</span>
   <span class="day-card__offer">${esc(d.offer)}</span>
  </button>
  ${dealDialog(d, { shop, link, id })}
 </li>`;
}
export function dealDialog(d, { shop, link, id }) {
  return `<dialog class="modal" id="${id}" aria-labelledby="${id}-title">
   <div class="modal__panel glass glass--strong">
    <button type="button" class="icon-btn modal__close" data-dialog-close aria-label="Close">${icon('close')}</button>
    <p class="eyebrow">${esc(d.day)}</p>
    <h3 id="${id}-title" class="modal__title">${esc(d.name)}</h3>
    <p class="modal__offer">${esc(d.offer)}</p>
    <p>${esc(d.detail)}</p>
    <a class="btn btn--primary" href="${link(shop.href)}">${esc(shop.text)}</a>
    <p class="fine modal__terms">${esc(d.terms)}</p>
   </div>
  </dialog>`;
}

/** Marquee of words: two identical halves, the second aria-hidden. variant 'outline' alternates outlined/filled words. */
export function marquee(words, { variant = 'outline', speed = 46, reverse = false, label = '' } = {}) {
  // each word travels with its separator (.mq-item), so a still, wrapped marquee never starts a line with "✦"
  const half = (hidden) => `<div class="marquee__half"${hidden ? ' aria-hidden="true"' : ''}>${words.map((w, i) => `<span class="mq-item"><span class="mq-word${variant === 'outline' && i % 2 ? ' mq-word--outline' : ''}">${esc(w)}</span><span class="mq-sep" aria-hidden="true">✦</span></span>`).join('')}</div>`;
  return `<div class="marquee mq--${variant}${reverse ? ' marquee--reverse' : ''}" style="--mq:${speed}s"${label ? ` role="region" aria-label="${esc(label)}"` : ''}><div class="marquee__track">${half(false)}${half(true)}</div></div>`;
}

/** Compact inner-page hero (every page except home): eyebrow, h1 with accent, lede, optional actions/meta. Never taller than a screen. */
// `before` (alias `crumbs`): markup placed ahead of the eyebrow/h1 (breadcrumbs, a back link, a meta row).
export function pageHero({ eyebrow, title, accent, lede, actions = '', meta = '', id = 'page-title', variant = '', ghost = '', before = '', crumbs = '' }) {
  const t = Array.isArray(title) ? twoLine(title, accent) : withAccent(title, accent);
  return `<section class="page-hero pool pool--breathe${variant ? ' page-hero--' + variant : ''}" aria-labelledby="${id}">
 ${particles(12)}
 ${ghost ? `<span class="ghost-word page-hero__ghost" aria-hidden="true">${esc(ghost)}</span>` : ''}
 <div class="container page-hero__in">
  ${before}${crumbs}
  ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
  <h1 id="${id}">${t}</h1>
  ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
  ${meta}
  ${actions ? `<div class="page-hero__actions">${actions}</div>` : ''}
 </div>
</section>`;
}
