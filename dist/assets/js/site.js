/* site.js — shared behaviour for every page. No dependencies. Progressive: every page reads fully without it.
   Hooks are listed in docs/BUILD-CONTRACT.md §4. */
(function () {
  'use strict';
  var d = document, html = d.documentElement, CFG = window.SAD || {};
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var visibleFocusables = function (root) { return $$(FOCUSABLE, root).filter(function (el) { return el.offsetWidth || el.offsetHeight || el.getClientRects().length; }); };
  function trap(root, e) {
    if (e.key !== 'Tab') return;
    var f = visibleFocusables(root); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (d.activeElement === first || !root.contains(d.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (d.activeElement === last || !root.contains(d.activeElement))) { e.preventDefault(); first.focus(); }
  }

  /* ---------- New York clock (the store's time; the live site computes hours the same way) ---------- */
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function nyNow() {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    var get = function (t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : '0'; };
    var day = DAYS.indexOf(get('weekday')); var hour = parseInt(get('hour'), 10); if (hour === 24) hour = 0;
    return { day: day < 0 ? 0 : day, hour: hour, minute: parseInt(get('minute'), 10) };
  }
  function fmtHour(h) { return h === 0 || h === 24 ? '12AM' : h === 12 ? '12PM' : h < 12 ? h + 'AM' : (h - 12) + 'PM'; }
  /* port of the live site's status function: same thresholds, same words */
  function storeStatus() {
    var hrs = CFG.hours || []; var n = nyNow(); var today = hrs[n.day]; var m = n.hour * 60 + n.minute;
    if (today && m >= today[0] * 60 && m < today[1] * 60) {
      var left = today[1] * 60 - m;
      return { open: true, label: CFG.open || 'Open Now', detail: left <= 60 ? 'Closes in ' + left + ' min' : 'Open until ' + fmtHour(today[1]) };
    }
    if (today && m < today[0] * 60) return { open: false, label: CFG.closed || 'Closed', detail: 'Opens today at ' + fmtHour(today[0]) };
    for (var i = 1; i <= 7; i++) { var nx = hrs[(n.day + i) % 7]; if (nx) return { open: false, label: CFG.closed || 'Closed', detail: 'Opens ' + (i === 1 ? 'tomorrow' : DAYS[(n.day + i) % 7]) + ' at ' + fmtHour(nx[0]) }; }
    return { open: false, label: CFG.closed || 'Closed', detail: 'Hours unavailable' };
  }
  function paintStatus() {
    var s = storeStatus();
    $$('[data-status]').forEach(function (el) {
      el.setAttribute('data-open', s.open ? 'true' : 'false');
      var l = $('[data-status-label]', el), dt = $('[data-status-detail]', el);
      if (l) l.textContent = s.label; if (dt) dt.textContent = '· ' + s.detail;
    });
  }
  paintStatus(); setInterval(paintStatus, 30000);

  /* today's weekly special (America/New_York weekday) */
  function markToday() {
    var day = String(nyNow().day);
    $$('[data-day]').forEach(function (el) {
      var on = el.getAttribute('data-day') === day;
      if (on) el.setAttribute('data-today', ''); else el.removeAttribute('data-today');
      var b = $('[data-today-badge]', el); if (b) b.hidden = !on;
    });
    $$('[data-today-scroll]').forEach(function (rail) {
      var t = $('[data-today]', rail); if (!t || rail.scrollWidth <= rail.clientWidth) return;
      /* rect deltas: offsetLeft is measured against a different offsetParent than the rail */
      var pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
      rail.scrollLeft = Math.max(0, rail.scrollLeft + t.getBoundingClientRect().left - rail.getBoundingClientRect().left - pad);
    });
    $$('[data-today-text]').forEach(function (el) { var src = $('[data-day="' + day + '"] [data-deal-name]'); if (src) el.textContent = src.textContent; });
  }
  markToday();

  /* ---------- age gate ---------- */
  var gate = $('#age-gate');
  if (gate) {
    var gateKeys = function (e) { if (html.classList.contains('gate-open')) trap(gate, e); };
    if (html.classList.contains('gate-open')) { var y = $('[data-age-yes]', gate); if (y) setTimeout(function () { y.focus(); }, 30); }
    d.addEventListener('keydown', gateKeys);
    var yes = $('[data-age-yes]', gate), no = $('[data-age-no]', gate);
    if (yes) yes.addEventListener('click', function () {
      store.set('sad-age-verified', JSON.stringify({ v: 1, at: Date.now() }));
      html.classList.remove('gate-open');
      var m = $('#main'); if (m) m.focus({ preventScroll: true });
    });
    if (no) no.addEventListener('click', function () { window.location.href = 'https://google.com'; });
  }

  /* ---------- header state ---------- */
  var header = $('[data-header]');
  var onScroll = function () { if (header) header.classList.toggle('is-scrolled', window.scrollY > 8); };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- drawer ---------- */
  var drawer = $('#drawer'), toggle = $('.menu-toggle');
  function openDrawer() {
    if (!drawer) return;
    drawer.hidden = false; requestAnimationFrame(function () { drawer.classList.add('is-open'); });
    toggle && toggle.setAttribute('aria-expanded', 'true'); d.body.classList.add('no-scroll');
    var f = visibleFocusables($('.drawer__panel', drawer)); setTimeout(function () { (f[0] || drawer).focus(); }, 40);
  }
  function closeDrawer() {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('is-open'); toggle && toggle.setAttribute('aria-expanded', 'false'); d.body.classList.remove('no-scroll');
    var done = function () { drawer.hidden = true; };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done(); else setTimeout(done, 380);
    toggle && toggle.focus();
  }
  if (toggle) toggle.addEventListener('click', function () { toggle.getAttribute('aria-expanded') === 'true' ? closeDrawer() : openDrawer(); });
  $$('[data-drawer-close]').forEach(function (b) { b.addEventListener('click', closeDrawer); });
  d.addEventListener('keydown', function (e) {
    if (!drawer || drawer.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); } else trap($('.drawer__panel', drawer), e);
  });
  if (drawer) $$('a', drawer).forEach(function (a) { a.addEventListener('click', function () { if (a.getAttribute('href').charAt(0) === '#') closeDrawer(); }); });
  window.addEventListener('resize', function () { if (window.innerWidth >= 1100) closeDrawer(); });

  /* ---------- motion: pause control + reduced motion ---------- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  function setMotion(paused, persist) {
    if (paused) html.setAttribute('data-motion', 'paused'); else html.removeAttribute('data-motion');
    $$('[data-motion-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', paused ? 'true' : 'false');
      var label = paused ? b.getAttribute('data-label-play') : b.getAttribute('data-label-pause');
      b.setAttribute('aria-label', label); var t = $('[data-motion-text]', b); if (t) t.textContent = label;
    });
    $$('video[autoplay]').forEach(function (v) { try { paused ? v.pause() : v.play(); } catch (e) {} });
    if (persist) store.set('sad-motion', paused ? 'paused' : 'on');
  }
  setMotion(html.getAttribute('data-motion') === 'paused', false);
  $$('[data-motion-toggle]').forEach(function (b) { b.addEventListener('click', function () { setMotion(html.getAttribute('data-motion') !== 'paused', true); }); });

  /* ---------- scroll reveal (never delays content: early threshold, short, and a failsafe) ---------- */
  var reveals = $$('[data-reveal]');
  if (reveals.length) {
    if (!('IntersectionObserver' in window) || reduce.matches) reveals.forEach(function (el) { el.classList.add('is-in'); });
    else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
      reveals.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in'); else io.observe(el);
      });
      /* anything a jump-link or print skips past still shows */
      window.addEventListener('beforeprint', function () { reveals.forEach(function (el) { el.classList.add('is-in'); }); });
    }
  }

  /* ---------- rails ---------- */
  $$('[data-carousel]').forEach(function (c) {
    var rail = $('[data-rail]', c), prev = $('[data-prev]', c), next = $('[data-next]', c);
    if (!rail) return;
    var step = function () { var first = rail.children[0]; var gap = parseFloat(getComputedStyle(rail).columnGap) || 16; return first ? (first.getBoundingClientRect().width + gap) * Math.max(1, Math.floor(rail.clientWidth / (first.getBoundingClientRect().width + gap))) : rail.clientWidth * 0.8; };
    /* a rail of cards with nothing focusable inside (tier cards, bundles) must itself take keyboard focus while it scrolls
       sideways, or a keyboard user cannot reach the cards past the edge (axe: scrollable-region-focusable) */
    var bare = !rail.querySelector(FOCUSABLE);
    if (bare && !rail.hasAttribute('aria-label') && !rail.hasAttribute('aria-labelledby')) {
      var sec = c.closest('section'); var hd = sec && sec.querySelector('h2, h3');
      if (hd) { if (!hd.id) hd.id = 'rail-h-' + Math.random().toString(36).slice(2, 8); rail.setAttribute('aria-labelledby', hd.id); }
    }
    var sync = function () {
      var max = rail.scrollWidth - rail.clientWidth - 2; var over = max > 0;
      c.toggleAttribute('data-overflow', over);
      if (prev) { prev.disabled = !over || rail.scrollLeft <= 2; }
      if (next) { next.disabled = !over || rail.scrollLeft >= max; }
      if (bare) { if (over) rail.setAttribute('tabindex', '0'); else rail.removeAttribute('tabindex'); }
    };
    var go = function (dir) { rail.scrollBy({ left: dir * step(), behavior: reduce.matches ? 'auto' : 'smooth' }); };
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    rail.addEventListener('scroll', function () { window.requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', sync); sync(); setTimeout(sync, 400);
  });

  /* ---------- dialogs (deal details) ---------- */
  $$('[data-dialog]').forEach(function (btn) {
    var dlg = d.getElementById(btn.getAttribute('data-dialog'));
    if (!dlg || typeof dlg.showModal !== 'function') return;
    btn.addEventListener('click', function (e) { e.preventDefault(); dlg.showModal(); var c = $('[data-dialog-close]', dlg); if (c) c.focus(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    $$('[data-dialog-close]', dlg).forEach(function (c) { c.addEventListener('click', function () { dlg.close(); }); });
    dlg.addEventListener('close', function () { btn.focus(); });
  });

  /* ---------- filters / tabs: [data-filter-group] buttons filter [data-filter-item] by data-cat ---------- */
  $$('[data-filter-group]').forEach(function (g) {
    var scope = g.getAttribute('data-filter-scope') ? $(g.getAttribute('data-filter-scope')) : g.parentElement;
    var btns = $$('button[aria-pressed]', g);
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        var cat = b.getAttribute('data-cat') || '';
        var shown = 0;
        $$('[data-filter-item]', scope).forEach(function (it) { var on = !cat || (it.getAttribute('data-cat') || '').split(' ').indexOf(cat) >= 0; it.hidden = !on; if (on) shown++; });
        var empty = $('[data-filter-empty]', scope); if (empty) empty.hidden = shown > 0;
        /* rails inside the filtered scope start over and re-sync their arrows */
        $$('[data-rail]', scope).forEach(function (r) { r.scrollLeft = 0; r.dispatchEvent(new Event('scroll')); });
        g.dispatchEvent(new CustomEvent('filter', { detail: { cat: cat }, bubbles: true }));
      });
    });
  });

  /* ---------- forms: same endpoints + payloads as the live site ---------- */
  $$('form[data-api]').forEach(function (form) {
    var out = $('[data-form-status]', form), btn = $('button[type=submit]', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = {}; var extra = form.getAttribute('data-extra');
      $$('[name]', form).forEach(function (f) { if (f.type === 'checkbox' && !f.checked) return; var v = (f.value || '').trim(); if (v !== '' || f.hasAttribute('data-keep-empty')) data[f.name] = v; });
      if (extra) { try { var x = JSON.parse(extra); for (var k in x) data[k] = x[k]; } catch (er) {} }
      if (out) { out.textContent = form.getAttribute('data-msg-sending') || ''; out.removeAttribute('data-state'); }
      if (btn) btn.disabled = true;
      fetch(form.getAttribute('data-api'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) { if (out) { out.textContent = (res.j && res.j.error) || form.getAttribute('data-msg-error'); out.setAttribute('data-state', 'error'); } return; }
          var msg = form.getAttribute('data-msg-success');
          if (res.j && res.j.alreadySubscribed && form.getAttribute('data-msg-already')) msg = form.getAttribute('data-msg-already');
          if (out) { out.textContent = msg; out.setAttribute('data-state', 'success'); }
          form.reset();
        })
        .catch(function () { if (out) { out.textContent = form.getAttribute('data-msg-network'); out.setAttribute('data-state', 'error'); } })
        .then(function () { if (btn) btn.disabled = false; });
    });
  });
})();
