// 02-main — "Send a Message" (the live /api/contact form: same fields, labels and payload) beside Store Information
// (Location + Get Directions, Hours in the live table wording, Contact email) and the live Google map embed.
import { esc, attrs, icon } from '../../../lib/h.mjs';
import { withAccent } from '../../../lib/parts.mjs';
export const meta = { order: 2, id: 'main' };

function field(f) {
  const base = { id: f.id, name: f._name, required: f._required || false, maxlength: f._max, minlength: f._min || null };
  const ctl = f._type === 'textarea'
    ? `<textarea${attrs({ ...base, rows: 5 })}></textarea>`
    : `<input${attrs({ ...base, type: f._type, autocomplete: f._auto, inputmode: f._type === 'tel' ? 'tel' : null })}>`;
  return `<div class="field${f._wide ? ' span-2' : ''}"><label for="${esc(f.id)}">${esc(f.label)}</label>${ctl}</div>`;
}

export function render({ content: C }) {
  const F = C.form, S = C.store;
  const form = `<div class="ct-form glass pad-lg" id="contact-form" data-reveal>
   <h2 id="ct-form-title" class="ct-h2">${withAccent(F.title, F.titleAccent)}</h2>
   <form class="form-grid ct-form__grid"${attrs({ 'data-api': F.api, 'data-extra': JSON.stringify(F._payload), 'data-msg-sending': F.msgSending, 'data-msg-success': F.msgSuccess, 'data-msg-error': F.msgError, 'data-msg-network': F.msgNetwork })}>
    ${F.fields.map(field).join('\n    ')}
    <div class="span-2 ct-form__foot">
     <button type="submit" class="btn btn--primary btn--lg btn--block">${esc(F.button)}</button>
     <p class="form-status" data-form-status aria-live="polite"></p>
    </div>
   </form>
  </div>`;
  const L = S.location, Hh = S.hours, K = S.contact;
  const info = `<div class="ct-info glass glass--lit pad" data-reveal style="--i:1">
    <h2 id="ct-info-title" class="ct-h2">${withAccent(S.title, S.titleAccent)}</h2>
    <div class="ct-info__grid">
     <div class="ct-block">
      <h3 class="ct-block__title">${icon('pin')}${esc(L.title)}</h3>
      <p class="ct-block__addr">${L.lines.map(esc).join('<br>')}</p>
      <a class="link-arrow" href="${esc(L.directions.href)}" target="_blank" rel="noopener">${esc(L.directions.text)}</a>
     </div>
     <div class="ct-block">
      <h3 class="ct-block__title">${icon('clock')}${esc(Hh.title)}</h3>
      <dl class="ct-hours">${Hh.rows.map((r) => `<div><dt>${esc(r.days)}</dt><dd>${esc(r.time)}</dd></div>`).join('')}</dl>
     </div>
     <div class="ct-block ct-block--wide">
      <h3 class="ct-block__title">${icon('mail')}${esc(K.title)}</h3>
      <p><a class="ct-mail" href="mailto:${esc(K.email)}">${esc(K.email)}</a></p>
     </div>
    </div>
   </div>`;
  const map = `<figure class="ct-map frame" data-reveal style="--i:2">
    <iframe${attrs({ title: S.map.title, src: S.map.src, loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: true, tabindex: '-1' })}></iframe>
   </figure>`;
  return `<section class="ct-main pool" aria-labelledby="ct-form-title">
 <div class="container ct-main__grid">
  ${form}
  <div class="ct-side">
   ${info}
   ${map}
  </div>
 </div>
</section>`;
}
