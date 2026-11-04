// 03-apply — the application form: the live fields, labels, placeholders, limits and role options; posts the live
// payload {site:"sfd", role, name, email, phone?, availability?, experience?, resumeUrl?, message?} to /api/careers/apply
// through site.js. Desktop: heading left, a 2-column glass form right (one screen); the two long-placeholder / long-label
// fields (Availability, Resume Link) take a full row so nothing is clipped.
import { esc, attrs } from '../../lib/h.mjs';
import { withAccent } from '../../lib/parts.mjs';
export const meta = { order: 3, id: 'apply' };

export function render({ content: C }) {
  const F = C.apply; const L = F.fields; const M = F.messages;
  const label = (id, f) => `<label for="${id}">${esc(f.label)}${f.hint ? ` <span class="opt">${esc(f.hint)}</span>` : ''}</label>`;
  const input = (id, name, f, a, cls = '') => `<div class="field${cls ? ' ' + cls : ''}">${label(id, f)}<input${attrs({ id, name, ...a, placeholder: f.placeholder || null })}></div>`;
  const area = (id, name, f, a) => `<div class="field field--area">${label(id, f)}<textarea${attrs({ id, name, ...a, placeholder: f.placeholder || null })}></textarea></div>`;
  const options = `<option value="">${esc(L.role.placeholder)}</option>` + F.options.map((o) => `<option value="${esc(o.value)}">${esc(o.text)}</option>`).join('');
  return `<section class="apply pool pool--warm" id="apply" aria-labelledby="apply-title">
 <div class="container apply__grid">
  <div class="apply__intro" data-reveal>
   <h2 id="apply-title">${withAccent(F.title, F.titleAccent)}</h2>
   <p class="lede">${esc(F.lede)}</p>
  </div>
  <form class="apply__form glass glass--strong"${attrs({ 'data-api': F.api, 'data-extra': JSON.stringify(F._extra), 'data-msg-success': M.success, 'data-msg-error': M.error, 'data-msg-network': M.network, 'data-msg-sending': M.sending })} style="--i:1" data-reveal>
   <div class="form-grid">
    <div class="field">${label('careers-role', L.role)}<select id="careers-role" name="role" required>${options}</select></div>
    ${input('careers-name', 'name', L.name, { type: 'text', required: true, maxlength: 120, autocomplete: 'name' })}
    ${input('careers-email', 'email', L.email, { type: 'email', required: true, maxlength: 254, autocomplete: 'email' })}
    ${input('careers-phone', 'phone', L.phone, { type: 'tel', maxlength: 40, autocomplete: 'tel' })}
    ${input('careers-availability', 'availability', L.availability, { type: 'text', maxlength: 200 }, 'span-2')}
    ${input('careers-resume', 'resumeUrl', L.resume, { type: 'url', maxlength: 500 }, 'span-2')}
    ${area('careers-experience', 'experience', L.experience, { rows: 5, maxlength: 5000 })}
    ${area('careers-motivation', 'message', L.message, { rows: 4, maxlength: 5000 })}
    <div class="span-2 apply__submit">
     <button type="submit" class="btn btn--primary btn--lg">${esc(F.submit)}</button>
     <p class="form-status" data-form-status aria-live="polite"></p>
    </div>
   </div>
  </form>
 </div>
</section>`;
}
