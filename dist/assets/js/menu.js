/* menu.js — the live Dutchie embedded menu on /shop/ and /shop/<category>/ (docs/CHANGE-LOG.md, "Menu = Dutchie").
   Live behaviour reproduced:
   - the page inserts <script id="dutchie--embed__script" async src="…/embedded-menu/699a62e4906190ac014a622c.js?menuType=rec">
     into the slot; Dutchie draws #dutchie--embed__container > iframe#dutchie--embed__iframe right after it;
   - a category page carries ?dtche[category]=<slug> in its URL (history.replaceState) and, once the iframe exists,
     points it at /embedded-menu/springfield-ave-dispensary/products/<slug>;
   - /shop/?dtche[category]=<slug> (the homepage category tiles) opens that category.
   - the category links are plain links to the category pages (/shop, /shop/<slug>), as live;
   - on /shop/ the chip of the category opened by ?dtche[category]= is marked (aria-current="true").
   Redesign additions: a skeleton holds the reserved height until the iframe loads; when the script fails or never
   arrives, the slot shows a link to the Dutchie menu (also the no-JS view, via CSS).
   Hooks: [data-dutchie][data-category] (+ data-script-src, data-store-path, data-slugs, data-url-category), [data-dutchie-mount],
   [data-dutchie-status], [data-dutchie-fallback], [data-menu-filters] a[data-slug]. Data attributes carry every URL. */
(function () {
  'use strict';
  var d = document;
  var slot = d.querySelector('[data-dutchie]');
  if (!slot) return;
  var SRC = slot.getAttribute('data-script-src');
  var BASE = slot.getAttribute('data-store-path') || '';
  var SLUGS = (slot.getAttribute('data-slugs') || '').split(/\s+/).filter(Boolean);
  var URLCAT = slot.hasAttribute('data-url-category');
  var PARAM = 'dtche[category]';
  var LATE_MS = 15000;   /* no iframe by then: show the link to the Dutchie menu */
  var QUIET_MS = 12000;  /* iframe loaded but no message from Dutchie by then: show the link above it */
  var mount = slot.querySelector('[data-dutchie-mount]');
  var status = slot.querySelector('[data-dutchie-status]');
  var nav = d.querySelector('[data-menu-filters]');
  var chips = nav ? Array.prototype.slice.call(nav.querySelectorAll('a[data-slug]')) : [];
  var valid = function (s) { return !!s && SLUGS.indexOf(s) >= 0; };
  var trim = function (p) { return p.replace(/\/+$/, ''); };

  function setState(s) {
    slot.setAttribute('data-state', s);
    if (s === 'loading') slot.setAttribute('aria-busy', 'true'); else slot.removeAttribute('aria-busy');
    if (status) status.hidden = s !== 'loading';
  }
  function urlParam() {
    try { var v = new URLSearchParams(window.location.search).get(PARAM); return valid(v) ? v : ''; } catch (e) { return ''; }
  }
  function writeParam(cat) {
    try {
      var u = new URL(window.location.href);
      if (cat) u.searchParams.set(PARAM, cat); else u.searchParams.delete(PARAM);
      var next = u.pathname + u.search + u.hash;
      if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', next);
    } catch (e) { /* file:// or a locked history: the embed still works */ }
  }
  function wantPath(cat) { return BASE + (cat ? 'products/' + cat : ''); }
  function point(frame, cat) {
    var raw = frame.getAttribute('src');
    if (!raw || !BASE) return;
    try {
      var u = new URL(raw, window.location.href);
      if (trim(u.pathname) === trim(wantPath(cat))) return;
      u.pathname = wantPath(cat);
      frame.setAttribute('src', u.toString());
    } catch (e) {}
  }
  /* the active chip: aria-current="page" when its link is this very page, "true" when /shop/ opened it from the URL */
  function mark(cat) {
    var here = trim(window.location.pathname);
    chips.forEach(function (a) {
      if ((a.getAttribute('data-slug') || '') === cat) a.setAttribute('aria-current', trim(a.pathname) === here ? 'page' : 'true');
      else a.removeAttribute('aria-current');
    });
    centre();
  }
  /* keep the active chip in view on the swipe row (phones) without moving the page */
  function centre() {
    var a = nav && nav.querySelector('a[aria-current]'); var row = a && a.closest('.filters');
    if (!row || row.scrollWidth <= row.clientWidth) return;
    var r = a.getBoundingClientRect(), rr = row.getBoundingClientRect();
    row.scrollLeft += (r.left - rr.left) - (rr.width - r.width) / 2;
  }

  /* ---- which category: the page's own (category pages) or ?dtche[category]= (homepage tiles -> /shop/) */
  var cat = slot.getAttribute('data-category') || '';
  if (!cat && URLCAT) cat = urlParam();
  slot.setAttribute('data-category', cat);
  if (cat) writeParam(cat);
  if (URLCAT) mark(cat); else centre();

  /* ---- Dutchie adds a "Skip to menu" button as the body's first child: keep the site's skip link first, it second */
  function tidy() {
    var skip = d.getElementById('dutchie--skip-to-menu'), ours = d.querySelector('a.skip-link');
    if (skip && ours && ours.nextElementSibling !== skip) ours.parentNode.insertBefore(skip, ours.nextSibling);
  }

  /* ---- the embed */
  var frame = null, lateTimer = 0, quietTimer = 0, alive = false;
  function fail() { if (slot.getAttribute('data-state') !== 'ready') setState('error'); }
  /* the menu app inside the iframe talks to Dutchie's parent script with postMessage (that is how it sizes the iframe);
     any message from a dutchie.com origin means the menu is really running */
  window.addEventListener('message', function (e) {
    if (!/^https:\/\/([a-z0-9-]+\.)*dutchie\.com$/i.test(e.origin || '')) return;
    alive = true; window.clearTimeout(quietTimer); slot.removeAttribute('data-quiet');
  });
  function adopt(f) {
    if (frame === f) return;
    frame = f;
    point(f, cat);
    f.addEventListener('load', function () {
      window.clearTimeout(lateTimer); setState('ready');
      if (!alive) { window.clearTimeout(quietTimer); quietTimer = window.setTimeout(function () { if (!alive) slot.setAttribute('data-quiet', ''); }, QUIET_MS); }
    });
  }
  function scan() {
    var f = d.getElementById('dutchie--embed__iframe');
    if (f) adopt(f);
    tidy();
  }
  var mo = 'MutationObserver' in window ? new MutationObserver(scan) : null;
  function start() {
    if (!SRC || !mount) { fail(); return; }
    if (d.getElementById('dutchie--embed__script')) { scan(); return; }
    setState('loading');
    if (mo) mo.observe(d.body, { childList: true, subtree: true });
    var s = d.createElement('script');
    s.id = 'dutchie--embed__script';
    s.async = true;
    s.src = SRC;
    s.addEventListener('error', fail);
    mount.appendChild(s);
    lateTimer = window.setTimeout(function () { if (!frame) fail(); else if (slot.getAttribute('data-state') === 'loading') fail(); }, LATE_MS);
    if (!mo) window.setTimeout(scan, 3000);
  }
  start();

})();
