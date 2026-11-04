// 05-featured — "Featured Deals": four glass tiles (First Visit · Bring a Friend · Curated Bundles · Loyalty).
// >= 1280px: one row of four that fits one screen under the header. Below: a swipe rail (shared rail controls).
// "New to Treehouse?" is the live text, kept verbatim (CHANGE-LOG F1). Bundles + Loyalty keep their live COMING SOON badges (F2).
import { esc } from '../../lib/h.mjs';
import { sectionHead, railControls, twoLine } from '../../lib/parts.mjs';
export const meta = { order: 5, id: 'featured' };

const badges = (list) => `<p class="fx__badges">${list.map(([text, cls]) => `<span class="badge${cls ? ' ' + cls : ''}">${esc(text)}</span>`).join(' ')}</p>`;
const head = (t, list, link) => `${badges(list)}
     <h3 class="fx__title t-break">${twoLine(t.title, t.titleAccent)}</h3>
     <p class="fx__text">${esc(t.text)}</p>`;
const cta = (t, link) => `<a class="btn btn--ghost btn--sm fx__cta" href="${link(t.cta.href)}">${esc(t.cta.text)}</a>`;

export function render({ content: C, link }) {
  const F = C.featured;
  const v = F.firstVisit, fr = F.friend, bu = F.bundles, lo = F.loyalty;

  const first = `<div class="fx__main">${head(v, [[v.badge, 'badge--live']], link)}</div>
    <div class="fx__aside fx__stat">
     <p class="stat"><span class="stat__num stat__num--outline">${esc(v.stat.num)}</span> <span class="stat__label">${esc(v.stat.label)}</span></p>
     <ul class="fx__points" role="list">${v.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </div>
    ${cta(v, link)}`;

  const friend = `<div class="fx__main">${head(fr, [[fr.badges[0], 'badge--live'], [fr.badges[1], '']], link)}</div>
    <div class="fx__aside">
     <ul class="fx__pair" role="list">${fr.people.map((p) => `<li class="fx__person"><span class="fx__initial" aria-hidden="true">${esc(p.initial)}</span> <span class="fx__who"><b>${esc(p.who)}</b> <span>${esc(p.line)}</span></span></li>`).join('')}</ul>
     <p class="fx__terms">${esc(fr.terms)}</p>
    </div>
    ${cta(fr, link)}`;

  const bundles = `<div class="fx__main">${head(bu, [[bu.badges[0], 'badge--soon'], [bu.badges[1], '']], link)}</div>
    <ul class="fx__aside fx__tiers" role="list">${bu.tiers.map((t) => `<li class="fx__tier"><span class="fx__price">${esc(t.price)}</span> <span class="fx__tname">${esc(t.name)}</span> <span class="fx__tline">${esc(t.line)}</span></li>`).join('')}</ul>
    ${cta(bu, link)}`;

  const loyalty = `<div class="fx__main">${head(lo, [[lo.badge, 'badge--soon']], link)}</div>
    <ul class="fx__aside fx__levels" role="list">${lo.tiers.map((t, i) => `<li class="fx__level fx__level--${i + 1}"><span class="fx__medal" aria-hidden="true"></span> <span class="fx__lname">${esc(t.name)}</span> <span class="fx__lline">${esc(t.line)}</span></li>`).join('')}</ul>
    ${cta(lo, link)}`;

  const tiles = [['first', first], ['friend', friend], ['bundles', bundles], ['loyalty', loyalty]]
    .map(([k, html], i) => `<li class="fx fx--${k}" style="--i:${i}" data-reveal><div class="fx__card glass card card--hover">
    ${html}
   </div></li>`).join('');

  return `<section class="featured pool" id="featured-deals" aria-labelledby="featured-title">
 <div class="container">
  ${sectionHead({ eyebrow: F.eyebrow, title: F.title, accent: F.titleAccent, link, id: 'featured-title' })}
  <div class="carousel featured__carousel" data-carousel>
   <ul class="rail rail--bleed featured__rail" data-rail role="list">${tiles}</ul>
   <div class="featured__controls">${railControls()}</div>
  </div>
 </div>
</section>`;
}
