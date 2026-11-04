// 02-roles — the nine open roles. Desktop (>= 1100 x 840): a 3 x 3 grid of compact glass cards; otherwise a swipe
// rail. Each card: title, type, summary and a fixed button row: "Details" (opens that role's <dialog> holding the two
// live lists; site.js [data-dialog] opens it as a modal, Escape / backdrop / Close shut it) + "Apply Now" (a real link
// to #apply; careers.js preselects the role). Opening a role never changes the card, its row or the section height.
import { esc, icon } from '../../lib/h.mjs';
import { withAccent, railControls } from '../../lib/parts.mjs';
export const meta = { order: 2, id: 'roles' };

const list = (items) => `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

export function render({ content: C, link }) {
  const R = C.roles;
  const cards = R.items.map((r, n) => {
    const id = `role-${r.slug}`;
    return `<li class="role" id="${id}" style="--i:${n % 3}" data-reveal>
   <article class="role-card glass card card--hover" aria-labelledby="${id}-title">
    <div class="role-card__head">
     <span class="icon-disc">${icon(r.icon)}</span>
     <div><h3 id="${id}-title">${esc(r.title)}</h3><p class="role-card__type">${esc(r.type)}</p></div>
    </div>
    <p class="role-card__summary">${esc(r.summary)}</p>
    <div class="role-card__foot">
     <button type="button" class="role-card__more" data-dialog="${id}-details" aria-haspopup="dialog" aria-describedby="${id}-title">${esc(R.detailsLabel)}${icon('chevR')}</button>
     <a class="btn btn--ghost btn--sm role-card__apply" href="#apply" data-apply-role="${esc(r.value)}" aria-describedby="${id}-title">${esc(R.applyLabel)}</a>
    </div>
   </article>
   <dialog class="modal role-modal" id="${id}-details" aria-labelledby="${id}-details-title">
    <div class="modal__panel glass glass--strong">
     <button type="button" class="icon-btn modal__close" data-dialog-close aria-label="Close">${icon('close')}</button>
     <p class="eyebrow">${esc(r.type)}</p>
     <h3 id="${id}-details-title" class="modal__title">${esc(r.title)}</h3>
     <div class="role-modal__lists">
      <div><h4>${esc(R.doLabel)}</h4>${list(r.do)}</div>
      <div><h4>${esc(R.lookLabel)}</h4>${list(r.look)}</div>
     </div>
     <a class="btn btn--primary role-modal__apply" href="#apply" data-apply-role="${esc(r.value)}" aria-describedby="${id}-details-title">${esc(R.applyLabel)}</a>
    </div>
   </dialog>
  </li>`;
  }).join('');
  return `<section class="roles pool" id="roles" aria-labelledby="roles-title">
 <div class="container">
  <div class="sec-head roles__head" data-reveal>
   <div><p class="eyebrow">${esc(R.eyebrow)}</p><h2 id="roles-title">${withAccent(R.title, R.titleAccent)}</h2><p class="lede">${esc(R.lede)}</p></div>
   <a class="link-arrow link-arrow--noarrow roles__skip" href="${link(R.skip.href)}">${esc(R.skip.text)}</a>
  </div>
  <div class="carousel roles__carousel" data-carousel>
   <ul class="rail rail--bleed roles__rail" data-rail role="list">${cards}</ul>
   <div class="roles__controls">${railControls()}</div>
  </div>
 </div>
</section>`;
}
