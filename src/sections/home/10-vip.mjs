// 10-vip — "Join the VIP List": a glass--accent panel with the live newsletter form. site.js posts the live payload
// {email, site:"sfd", source:"home_vip_newsletter"} to /api/newsletter/subscribe and writes the live messages into
// [data-form-status]. The section keeps the live anchor id "vip-newsletter".
import { esc, attrs, icon, particles } from '../../lib/h.mjs';
import { withAccent } from '../../lib/parts.mjs';
import { labels } from './_lib/labels.mjs';
export const meta = { order: 10, id: 'vip' };

export function render({ content: C, root }) {
  const V = C.vip;
  const L = labels(root);
  const form = attrs({
    class: 'vip__form', 'data-api': V.api, 'data-extra': JSON.stringify(V._payload),
    'data-msg-sending': L('Subscribing…'),
    'data-msg-success': L("You're in. Watch your inbox for VIP-only deals."),
    'data-msg-already': L("You're already on the VIP list — see you at the next drop."),
    'data-msg-error': L('Something went wrong. Please try again.'),
    'data-msg-network': L('Network error. Please try again.'),
  });
  return `<section class="vip pool pool--breathe" id="vip-newsletter" aria-labelledby="vip-title">
 ${particles(10)}
 <div class="container container--narrow">
  <div class="vip__panel glass glass--accent" data-reveal>
   <span class="icon-disc vip__icon">${icon('mail')}</span>
   <h2 id="vip-title">${withAccent(V.title, V.titleAccent)}</h2>
   <p class="lede vip__text">${esc(V.text)}</p>
   <form${form}>
    <label class="sr-only" for="vip-email">${esc(L('Email address'))}</label>
    <input class="input vip__input" id="vip-email" type="email" name="email" placeholder="${esc(V.placeholder)}" autocomplete="email" required>
    <button type="submit" class="btn btn--primary btn--lg vip__btn">${esc(V.button)}</button>
    <p class="form-status vip__status" data-form-status aria-live="polite"></p>
   </form>
  </div>
 </div>
</section>`;
}
