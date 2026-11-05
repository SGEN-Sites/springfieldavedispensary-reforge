// chrome.mjs — the shared document: head, header, drawer, phone dock, order bar, footer, age gate. One consistent system on every page.
import { esc, attrs, img, icon } from './h.mjs';
import { withAccent } from './parts.mjs';

const isCurrent = (pagePath, href) => {
  if (href === '') return pagePath === '' ? 'page' : null;
  return pagePath === href || (href !== '' && pagePath.startsWith(href)) ? 'page' : null;
};

/** The pre-paint gate check: shows the age gate before first paint when the visitor has not answered (no flash of content). */
const GATE_BOOT = `(function(){var d=document.documentElement;d.classList.add('js');try{var v=JSON.parse(localStorage.getItem('sad-age-verified')||'null');if(!(v&&v.v===1&&Date.now()-v.at<2592e6))d.classList.add('gate-open');if(localStorage.getItem('sad-motion')==='paused')d.setAttribute('data-motion','paused')}catch(e){d.classList.add('gate-open')}})();`;

export function head({ page, link, css, extraHead = '' }) {
  const h = page.head;
  const og = Object.entries(h.og || {}).map(([k, v]) => k.startsWith('og:')
    ? `<meta property="${esc(k)}" content="${esc(v)}">` : `<meta name="${esc(k)}" content="${esc(v)}">`).join('\n');
  const ld = (h.ld || []).map((s) => `<script type="application/ld+json">${s.replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(h.title)}</title>
<meta name="description" content="${esc(h.description)}">
${h.robots ? `<meta name="robots" content="${esc(h.robots)}">\n` : ''}<meta name="theme-color" content="#07110b">
${h.canonical ? `<link rel="canonical" href="${esc(h.canonical)}">` : ''}
<link rel="icon" href="${link('assets/img/favicon.ico')}" sizes="any">
<link rel="icon" type="image/svg+xml" href="${link('assets/img/favicon.svg')}">
<link rel="icon" type="image/png" sizes="192x192" href="${link('assets/img/favicon-192.png')}">
<link rel="icon" type="image/png" sizes="32x32" href="${link('assets/img/favicon-32.png')}">
<link rel="apple-touch-icon" href="${link('assets/img/favicon-192.png')}">
${og}
${ld}
<link rel="preload" href="${link('assets/fonts/bricolage-latin.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${link('assets/fonts/inter-latin.woff2')}" as="font" type="font/woff2" crossorigin>
<script>${GATE_BOOT}</script>
${css.map((c) => `<link rel="stylesheet" href="${link(c)}">`).join('\n')}
${extraHead}
</head>`;
}

const status = (S, extra = '') => `<p class="status"${extra} data-status aria-live="polite"><span class="status__dot" aria-hidden="true"></span><span class="status__label" data-status-label>${esc(S.status.open)}</span><span class="status__detail" data-status-detail></span></p>`;
const motionBtn = (S, cls = 'motion-toggle') => `<button type="button" class="${cls}" data-motion-toggle aria-pressed="false" aria-label="${esc(S.motion.pause)}" data-label-pause="${esc(S.motion.pause)}" data-label-play="${esc(S.motion.play)}">${icon('pause', 'i-pause')}${icon('play', 'i-play')}${cls.includes('--text') ? `<span data-motion-text>${esc(S.motion.pause)}</span>` : ''}</button>`;

export function header({ S, link, pagePath }) {
  const nav = S.nav.map((n) => `<li><a href="${link(n.href)}"${attrs({ 'aria-current': isCurrent(pagePath, n.href) })}>${esc(n.text)}</a></li>`).join('');
  return `<a class="skip-link" href="#main">${esc(S.skip)}</a>
<div class="atmos" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>
<header class="site-header" data-header>
 <div class="site-header__in">
  <a class="brand" href="${link('')}" aria-label="${esc(S.brand.name)}">
   <span class="seal">${img('logo-96', { link, alt: '', eager: true, decorative: true, width: 96, height: IMGH('logo-96') })}</span>
   <span class="brand__word"><span>${esc(S.brand.line1)}</span><span>${esc(S.brand.line2)}</span></span>
  </a>
  <nav class="nav-primary" aria-label="Primary"><ul>${nav}</ul></nav>
  <div class="header-actions">
   ${status(S)}
   ${motionBtn(S)}
   <a class="btn btn--primary btn--sm" href="${link('shop/')}" data-shop-now>${esc(S.shopNow)}</a>
   <button type="button" class="menu-toggle" aria-controls="drawer" aria-expanded="false" aria-label="${esc(S.menuOpen)}">${icon('menu')}</button>
  </div>
 </div>
</header>
<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="${esc(S.brand.name)}" hidden>
 <div class="drawer__scrim" data-drawer-close></div>
 <div class="drawer__panel">
  <div class="drawer__top">
   <a class="brand" href="${link('')}" aria-label="${esc(S.brand.name)}"><span class="seal">${img('logo-96', { link, alt: '', decorative: true, width: 96, height: IMGH('logo-96') })}</span><span class="brand__word"><span>${esc(S.brand.line1)}</span><span>${esc(S.brand.line2)}</span></span></a>
   <button type="button" class="icon-btn" data-drawer-close aria-label="${esc(S.menuClose)}">${icon('close')}</button>
  </div>
  ${status(S)}
  <a class="btn btn--primary btn--lg btn--block" href="${link('shop/')}" data-shop-now>${icon('bag')}${esc(S.shopNow)}</a>
  <nav class="drawer__nav" aria-label="Menu"><ul>${S.nav.map((n) => `<li><a href="${link(n.href)}"${attrs({ 'aria-current': isCurrent(pagePath, n.href) })}>${esc(n.text)}</a></li>`).join('')}</ul></nav>
  <div class="drawer__meta">
   <p class="info">${icon('pin')}<span>${esc(S.address.oneLine)}</span></p>
   <p class="info">${icon('clock')}<span>${S.footer.hours.map(esc).join('<br>')}</span></p>
   <a class="link-arrow" href="${esc(S.directionsHref)}" target="_blank" rel="noopener">${esc(S.dock.directions)}</a>
   ${motionBtn(S, 'motion-toggle motion-toggle--text')}
  </div>
 </div>
</div>`;
}

export function dock({ S, link, pagePath }) {
  return `<nav class="dock" aria-label="Quick actions">
 <a href="${link('deals/')}"${attrs({ 'aria-current': pagePath === 'deals/' ? 'page' : null })}>${icon('tag')}<span>${esc(S.dock.deals)}</span></a>
 <a class="dock__primary" href="${link('shop/')}" data-shop-now>${icon('bag')}<span>${esc(S.shopNow)}</span></a>
 <a href="${esc(S.directionsHref)}" target="_blank" rel="noopener">${icon('map')}<span>${esc(S.dock.directions)}</span></a>
</nav>`;
}

/** Order bar (tablet + desktop; the phone dock does this job below 768px): Order Online + Get Directions, the live
 *  open/closed status and the live payment answer. Not on the menu pages: they ARE the order flow and the bar would sit
 *  over the embed. Hidden with no JS; site.js shows it once the first section has scrolled up (BUILD-CONTRACT §4). */
export function pickupBar({ S, link, pagePath }) {
  if (pagePath.startsWith('shop/')) return '';
  const B = S.pickupBar;
  return `<aside class="pickup" data-pickup aria-label="${esc(B.label)}">
 <span class="pickup__mark" aria-hidden="true">${icon('bag')}</span>
 <div class="pickup__copy">
  <p class="pickup__title">${withAccent(B.title.text, B.title.accent)}</p>
  <p class="pickup__meta" data-status><span class="status__dot" aria-hidden="true"></span><span class="status__label" data-status-label>${esc(S.status.open)}</span><span class="status__detail" data-status-detail></span><span class="pickup__sep" aria-hidden="true">·</span><span class="pickup__pay">${esc(B.pay)}</span></p>
 </div>
 <a class="btn btn--primary btn--sm pickup__order" href="${link('shop/')}">${esc(B.order)}${icon('arrowR')}</a>
 <a class="btn btn--ghost btn--sm pickup__dir" href="${esc(S.directionsHref)}" target="_blank" rel="noopener">${icon('map')}<span>${esc(S.dock.directions)}</span></a>
 <button type="button" class="pickup__x" data-pickup-x aria-label="${esc(B.hide)}">${icon('close')}</button>
</aside>`;
}

export function footer({ S, link }) {
  const col = (title, links) => `<div class="footer-col"><h2>${esc(title)}</h2><ul>${links.map((l) => `<li><a href="${link(l.href)}">${esc(l.text)}</a></li>`).join('')}</ul></div>`;
  return `<footer class="site-footer">
 <div class="container">
  <div class="footer-grid">
   <div class="footer-brand">
    <a class="brand" href="${link('')}"><span class="seal" style="--seal:58px">${img('logo-192', { link, alt: S.brand.logoAlt })}</span><span class="brand__word" aria-hidden="true"><span>${esc(S.footer.brandLines[0])}</span><span>${esc(S.footer.brandLines[1])}</span></span></a>
    <p>${esc(S.footer.blurb)}</p>
   </div>
   ${col(S.footer.quickLinksTitle, S.footer.quickLinks)}
   <div class="footer-col footer-col--visit">
    <h2>${esc(S.footer.visitTitle)}</h2>
    <address>${esc(S.address.street)}<br>${esc(S.address.cityLine)}</address>
    <ul><li><a href="mailto:${esc(S.email)}">${esc(S.email).replace('@', '<wbr>@')}</a></li><li><a href="${esc(S.directionsHref)}" target="_blank" rel="noopener">${esc(S.dock.directions)}</a></li></ul>
   </div>
   <div class="footer-col">
    <h2>${esc(S.footer.hoursTitle)}</h2>
    <div class="hours">${S.footer.hours.map((h) => `<p>${esc(h)}</p>`).join('')}</div>
    <h2 style="margin-top:26px">${esc(S.footer.moreTitle)}</h2>
    <ul>${S.footer.moreLinks.map((l) => `<li><a href="${link(l.href)}">${esc(l.text)}</a></li>`).join('')}</ul>
   </div>
  </div>
  <div class="footer-bottom">
   <p>${esc(S.footer.copyright)}</p>
   ${motionBtn(S, 'motion-toggle motion-toggle--text')}
  </div>
 </div>
 <span class="footer-word" aria-hidden="true">${esc(S.brand.line1)}</span>
</footer>`;
}

export function ageGate({ S, link }) {
  const G = S.gate;
  return `<div class="age-gate" id="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title" aria-describedby="age-gate-desc">
 <div class="age-gate__panel glass glass--strong">
  <span class="seal">${img('logo-192', { link, alt: '', decorative: true, eager: true })}</span>
  <p class="age-gate__brand">${esc(S.brand.line1)}<span>${esc(S.brand.line2)}</span></p>
  <h2 id="age-gate-title">${esc(G.title)}</h2>
  <p id="age-gate-desc">${esc(G.body)}</p>
  <div class="age-gate__actions">
   <button type="button" class="btn btn--ghost btn--lg" data-age-no>${esc(G.no)}</button>
   <button type="button" class="btn btn--primary btn--lg" data-age-yes>${esc(G.yes)}</button>
  </div>
 </div>
</div>`;
}

import { IMAGES } from './h.mjs';
function IMGH(k) { const v = IMAGES[k]; return v ? v.h : null; }

/** The whole document. */
export function page({ page: pg, S, link, css, main, extraHead = '', scripts = [], bodyClass = '' }) {
  return `${head({ page: pg, link, css, extraHead })}
<body class="${esc(['tpl-' + pg.template, bodyClass].filter(Boolean).join(' '))}">
${header({ S, link, pagePath: pg.path })}
<main id="main" tabindex="-1">
${main}
</main>
${footer({ S, link })}
${[pickupBar({ S, link, pagePath: pg.path }), dock({ S, link, pagePath: pg.path })].filter(Boolean).join('\n')}
${ageGate({ S, link })}
<script>window.SAD=${JSON.stringify({ hours: S._weeklyHours, open: S.status.open, closed: S.status.closed })};</script>
${['assets/js/site.js', ...scripts].map((s) => `<script src="${link(s)}" defer></script>`).join('\n')}
</body>
</html>
`;
}
