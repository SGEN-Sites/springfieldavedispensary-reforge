// OPTION A — "The Corner Sign": the logo reimagined as a lit sculpture. Copy on the left (as today); on the right the
// logo's composition built in light: the New Jersey silhouette as a faint emerald light shape, a glowing pole with a pool
// of light at its foot, the "Springfield Ave" plate (small raised "Ave") and the counter-tilted "Dispensary" plate in
// emerald-lit glass, the real store photo as a small lit shop window, and two floating cut-outs at the pole's foot.
// Plates repeat the brand name already in the header, so the whole sign is aria-hidden decoration.
import { esc, img, icon, particles } from '../../lib/h.mjs';
export const meta = { order: 1, id: 'hero' };
// Owner pick 2026-11-04: Option A of audit/labs/hero-options (the previous hero is kept in src/labs/hero-options/v1/).

// New Jersey outline traced from the logo (logo-reference.jpg, 210 x 404 units; the stretch hidden behind the plates
// is bridged by hand). Decorative.
const NJ = 'M111 0 107 0 100 4 92 12 87 28 81 36 75 40 76 44 70 48 68 52 55 60 65 80 59 92 48 100 46 108 48 112 47 136 38 208 43 241 37 250 25 256 12 268 0 292 6 300 2 316 10 320 16 328 28 336 30 340 39 344 41 348 47 352 51 360 83 364 86 368 86 376 78 392 76 404 81 404 89 400 93 396 106 376 108 368 119 352 124 348 128 340 128 336 145 332 155 320 156 312 167 300 185 268 186 256 199 234 206 214 208 194 204 174 197 156 181 130 171 120 187 116 202 88 208 72 210 60Z';

export function render({ content: C, S, link }) {
  const H = C.hero;
  const [l1, l2] = H.h1;
  const i = l2.indexOf(H.h1Accent);
  const l2html = esc(l2.slice(0, i)) + `<span class="accent">${esc(H.h1Accent)}</span>` + esc(l2.slice(i + H.h1Accent.length));
  // the plate words are the live brand lines (shared.json): "Springfield Ave" -> "Springfield" + raised "Ave"
  const b1 = S.brand.line1; const cut = b1.lastIndexOf(' ');
  const street = b1.slice(0, cut); const suffix = b1.slice(cut + 1);
  return `<section class="hero hero--sign pool pool--breathe" data-hero id="top" aria-labelledby="hero-title">
 ${particles(20)}
 <div class="container hero__grid">
  <div class="hero__copy">
   <p class="eyebrow">${esc(H.eyebrow)}</p>
   <h1 id="hero-title"><span class="hero__l1">${esc(l1)}</span> <span class="hero__l2">${l2html}</span></h1>
   <p class="lede hero__tagline">${esc(H.tagline)}</p>
   <div class="hero__info">
    <p class="info">${icon('pin')}<span>${esc(H.address)}</span></p>
    <p class="info">${icon('clock')}<span>${esc(H.hours)}</span></p>
   </div>
   <div class="hero__ctas">
    <a class="btn btn--primary btn--lg" href="${link(H.ctaPrimary.href)}" data-primary-cta>${esc(H.ctaPrimary.text)}</a>
    <a class="btn btn--ghost btn--lg" href="${link(H.ctaSecondary.href)}">${esc(H.ctaSecondary.text)}</a>
   </div>
   <ul class="hero__stats" role="list">${H.stats.map((s) => `<li class="stat-chip glass glass--flat"><b>${esc(s.num)}</b><span>${esc(s.label)}</span></li>`).join('')}</ul>
  </div>
  <div class="hero__stage">
   <div class="sculpt">
    <span class="sculpt__halo" aria-hidden="true"></span>
    <svg class="sculpt__nj" viewBox="-8 -8 226 420" aria-hidden="true" focusable="false">
     <defs><radialGradient id="heroA-nj" cx="52%" cy="44%" r="66%"><stop offset="0" class="heroA-s0"/><stop offset=".55" class="heroA-s1"/><stop offset="1" class="heroA-s2"/></radialGradient></defs>
     <path d="${NJ}" fill="url(#heroA-nj)"/>
    </svg>
    <span class="sculpt__pool" aria-hidden="true"></span>
    <figure class="sculpt__window">${img('interior', { link, alt: H.photoAlt, eager: true, sizes: '(min-width: 1100px) 140px, 120px' })}</figure>
    <div class="sculpt__sign" aria-hidden="true">
     <span class="sculpt__pole"></span>
     <!-- the plates repeat the brand name (already in the header) as decoration: their words are drawn by CSS from
          data-text, so they are not document text (no duplicate brand words in the page copy) -->
     <div class="sculpt__sway sculpt__sway--low"><span class="plate plate--sub"><span class="plate__text" data-text="${esc(S.brand.line2)}"></span></span></div>
     <div class="sculpt__sway sculpt__sway--top"><span class="plate plate--main"><span class="plate__word" data-text="${esc(street)}"></span><span class="plate__ave" data-text="${esc(suffix)}"></span></span></div>
    </div>
    <div class="float sculpt__roll" style="--ft:9s;--fd:-3s;--fr0:-4deg;--fr1:-1deg" aria-hidden="true">${img('cut-prerolls-280', { link, decorative: true, eager: true })}</div>
    <div class="float sculpt__bud" style="--ft:11s;--fd:-6s;--fr0:-2deg;--fr1:2deg" aria-hidden="true">${img(['cut-flower-280', 'cut-flower-440'], { link, decorative: true, eager: true, sizes: '(min-width: 1100px) 150px, 110px' })}</div>
   </div>
  </div>
 </div>
</section>`;
}
