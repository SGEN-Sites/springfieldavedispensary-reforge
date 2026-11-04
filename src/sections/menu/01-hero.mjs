// 01-hero — the compact menu hero (/shop/ and /shop/<category>/), built on parts.pageHero.
// /shop/: eyebrow · h1 · intro · address | hours | Get Directions. Category pages: breadcrumb (All Products › <Cat>, via
// pageHero's `crumbs` slot) in place of the eyebrow · h1 · intro · address | hours (live: no directions link there).
// Wide screens add a small stage of floating cut-outs (decorative, lazy, hidden below 1024px so phones never download
// it); a category with no picture (topicals) gets the stage's light alone and the outlined ghost word, like the other
// inner pages (no picture is invented).
import { esc, img, icon, IMAGES } from '../../lib/h.mjs';
import { pageHero } from '../../lib/parts.mjs';

// every width variant of a cut-out: content names the base key ("cut-flower"), images.json / images.d hold
// "cut-flower-280", "cut-flower-440", … (smallest first, so img() builds the srcset)
function variants(base) {
  const keys = Object.keys(IMAGES).filter((k) => k.startsWith(base + '-') && /^\d+$/.test(k.slice(base.length + 1)));
  if (!keys.length) throw new Error(`menu hero: no width variants for image ${base}`);
  return keys.sort((a, b) => IMAGES[a].w - IMAGES[b].w);
}
// the stage is min(21vw, 300px) wide from 1024px up (01-hero.css --stage-w); hidden (display:none) below, so the lazy
// image is never fetched there. Three-up (/shop/): each cut-out is a fixed share of the stage. One-up (category pages):
// drawn at most 300px tall and never wider than the stage, so a portrait picture is at most 300 x aspect wide.
function sizesFor(n, i, v) {
  if (n === 3) {
    const f = [0.66, 0.44, 0.42][i];
    return `(min-width: 1429px) ${Math.round(300 * f)}px, (min-width: 1024px) ${(21 * f).toFixed(1)}vw, 1px`;
  }
  const w = Math.round(300 * v.w / v.h);
  return w >= 300 ? '(min-width: 1429px) 300px, (min-width: 1024px) 21vw, 1px' : `(min-width: 1024px) ${w}px, 1px`;
}

export function hero({ content: C, link }) {
  const H = C.hero;
  const sep = ` <span class="menu-meta__sep" aria-hidden="true">${esc(H.sep)}</span> `;
  const items = [
    `<span class="menu-meta__item">${icon('pin')}<span>${esc(H.address)}</span></span>`,
    `<span class="menu-meta__item">${icon('clock')}<span>${esc(H.hours)}</span></span>`,
  ];
  // live href kept verbatim (a bare https://maps.google.com, no destination: F11, an open owner call)
  if (H.directions) items.push(`<a class="menu-meta__link" href="${esc(H.directions.href)}" target="_blank" rel="noreferrer">${esc(H.directions.text)}</a>`);
  const linkSep = ` <span class="menu-meta__sep menu-meta__sep--link" aria-hidden="true">${esc(H.sep)}</span> `;
  const meta = `<p class="menu-meta">${items.slice(0, 2).join(sep)}${items[2] ? linkSep + items[2] : ''}</p>`;

  const cuts = H.cutouts || [];
  const stage = cuts.length
    ? `<div class="menu-hero__stage menu-hero__stage--${cuts.length}" aria-hidden="true">${cuts.map((c, i) => {
      const keys = variants(c.imageKey);
      // menu-cut-* (src/tools/menu-images.py) are cut tight to the product: no radial edge mask (it would fade the vape's
      // drip tip and the gummy bear on top)
      const tight = c.imageKey.startsWith('menu-cut-') ? ' menu-hero__cut--tight' : '';
      return `<div class="float menu-hero__cut menu-hero__cut--${i + 1}${tight}" style="--ft:${9 + i * 2}s;--fd:-${i * 2}s;--fr0:${i % 2 ? 3 : -2}deg;--fr1:${i % 2 ? -2 : 2}deg">${img(keys, { link, decorative: true, sizes: sizesFor(cuts.length, i, IMAGES[keys[keys.length - 1]]) })}</div>`;
    }).join('')}</div>`
    // no picture: the stage's light alone (its ::before glow, like the sister category pages), behind the ghost word
    : (H.ghost ? '<div class="menu-hero__stage menu-hero__stage--1 menu-hero__stage--empty" aria-hidden="true"></div>' : '');

  let crumbs = '';
  if (H.crumbs) {
    const B = H.crumbs;
    crumbs = `<nav class="menu-crumbs" aria-label="${esc(B.label)}"><a href="${link(B.parent.href)}">${esc(B.parent.text)}</a><span class="menu-crumbs__sep" aria-hidden="true">${esc(B.sep)}</span><span class="menu-crumbs__here" aria-current="page">${esc(B.current)}</span></nav>`;
  }
  // "Cannabis Flower — Irvington, NJ": a no-break space before the dash, so a narrow line breaks after the dash and never
  // starts with it (the text gates read U+00A0 as a space: src/tools/lib-text.mjs norm())
  const title = H.title.replace(/ —/g, ' —');
  return pageHero({ eyebrow: H.eyebrow, title, accent: H.titleAccent, lede: H.lede, meta: meta + stage, variant: 'menu', id: 'page-title',
    crumbs, ghost: cuts.length ? '' : (H.ghost || '') });
}
