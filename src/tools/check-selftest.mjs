#!/usr/bin/env node
// check-selftest.mjs - proves the rendered gate (check.mjs) and the axe runner (a11y-axe.mjs) can FAIL and can PASS.
// It builds a FIXTURE site under audit/labs/t2/fixture/clean/ (a tiny 2-page dark site that follows the build
// contract's DOM hooks, with its own small site.js; it is NOT the real site), runs check.mjs on it (must PASS, every
// rule measuring > 0 items somewhere), then makes one mutant per defect under audit/labs/t2/fixture/mutants/<id>/ (one
// exact edit each; an edit that changes nothing is itself a failure) and runs check.mjs --only <rule> on it: that
// rule must FAIL (read from the JSON report, and a crash of the tool does not count as a catch). Then a11y-axe.mjs: the
// clean fixture must pass, and an image without alt / a nameless button must fail.
//
// USAGE (through the browser lock: one browser at a time, all children inherit the slot):
//   sh src/tools/browser-lock.sh node src/tools/check-selftest.mjs [--cases R1-overflow,F8-wrong-key] [--no-clean]
//        [--no-axe] [--unlocked]
// Reports: audit/labs/t2/selftest/<case>.json (each child's own report) + audit/labs/t2/selftest.json (summary).
// A child that hangs is ended by its own watchdog (exit 3) or by the spawn timeout; it is retried ONCE, then
// reported as HUNG (not proven). EXIT 0 only when the clean runs pass and every mutant is caught.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2); const has = (k) => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const UNLOCKED = has('unlocked');
if (!process.env.BROWSER_LOCK_SLOT && !UNLOCKED) { console.error('check-selftest: run me through the browser lock: sh src/tools/browser-lock.sh node src/tools/check-selftest.mjs'); process.exit(2); }
const LAB = path.join(ROOT, 'audit/labs/t2'); const FIX = path.join(LAB, 'fixture'); const CLEAN = path.join(FIX, 'clean'); const MUTS = path.join(FIX, 'mutants'); const OUTS = path.join(LAB, 'selftest');
const CHECK = path.join(ROOT, 'src/tools/check.mjs'); const AXE = path.join(ROOT, 'src/tools/a11y-axe.mjs');
setTimeout(() => { console.error('check-selftest: WATCHDOG - the whole self-test exceeded 80 min (machine load?); ended with exit 3'); process.exit(3); }, 80 * 60 * 1000).unref();

// ------------------------------------------------------------------ fixture files
function crc32(b) { let crc = 0xffffffff; for (let n = 0; n < b.length; n++) { let c = (crc ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function makePng(w, h, fn) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const [r, g, b] = fn(x, y); const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const svgArt = (a, b, c) => `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/><circle cx="240" cy="180" r="92" fill="${c}"/></svg>`;
const ICON = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
const I_MENU = ICON('M4 7h16M4 12h16M4 17h16'), I_X = ICON('M6 6l12 12M18 6L6 18'), I_PAUSE = ICON('M9 6v12M15 6v12'), I_L = ICON('M15 6l-6 6 6 6'), I_R = ICON('M9 6l6 6-6 6');
const PAUSE_RULE = 'html[data-motion="paused"] *, html[data-motion="paused"] *::before, html[data-motion="paused"] *::after { animation-play-state: paused !important; }';
const CSS = `/* fixture site.css - lane T2 self-test fixture only */
:root { --bg: #0b120d; --ink: #f3efe4; --muted: #c3cbbd; --accent: #c8f560; --accent-ink: #10170f; --card: #152019; --line: rgba(243, 239, 228, .16); }
* { box-sizing: border-box; }
html { background: var(--bg); color: var(--ink); font: 16px/1.55 -apple-system, "Helvetica Neue", Arial, sans-serif; }
body { margin: 0; background: var(--bg); }
a { color: var(--ink); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
h1, h2, h3 { line-height: 1.15; margin: 0 0 12px; }
h2 { font-size: 28px; }
.wrap { max-width: 1200px; margin: 0 auto; padding: 0 16px; }
.skip-link { position: absolute; left: 8px; top: -120px; z-index: 100; display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-weight: 700; }
.skip-link:focus { top: 8px; }
.site-header { position: sticky; top: 0; z-index: 20; background: rgba(11, 18, 13, .96); border-bottom: 1px solid var(--line); }
.site-header__in { display: flex; align-items: center; gap: 10px; max-width: 1200px; margin: 0 auto; padding: 8px 16px; min-height: 64px; }
.brand { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; font-weight: 800; font-size: 18px; text-decoration: none; }
.nav-primary { display: flex; gap: 4px; }
.nav-primary a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; text-decoration: none; }
.status { margin: 0 0 0 auto; font-size: 14px; color: var(--muted); }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; border-radius: 999px; border: 0; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
.btn--primary { background: var(--accent); color: var(--accent-ink); }
.btn--ghost { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1px rgba(243, 239, 228, .45); }
.btn--sm { min-height: 44px; padding: 0 16px; font-size: 15px; }
.icon-btn { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 999px; border: 1px solid var(--line); background: #1c2a21; color: var(--ink); cursor: pointer; }
.menu-toggle { display: none; }
@media (max-width: 1099px) { .nav-primary { display: none; } .menu-toggle { display: inline-grid; } }
@media (max-width: 767px) { .status, .hdr-shop { display: none; } .site-header .icon-btn[data-motion-toggle] { margin-left: auto; } body { padding-bottom: 80px; } }
.drawer { position: fixed; inset: 0; z-index: 50; }
.drawer[hidden] { display: none; }
.drawer__scrim { position: absolute; inset: 0; background: rgba(0, 0, 0, .6); }
.drawer__panel { position: absolute; top: 0; right: 0; bottom: 0; width: min(360px, 86vw); display: flex; flex-direction: column; gap: 14px; padding: 16px; overflow: auto; background: #101a13; }
.drawer__panel .status { margin: 0; display: block; }
.drawer__nav a { display: flex; align-items: center; min-height: 48px; font-size: 18px; text-decoration: none; }
body.no-scroll { overflow: hidden; }
section { padding: 56px 0; }
.hero { position: relative; overflow: hidden; padding: 56px 0 48px; }
.eyebrow { margin: 0 0 10px; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.hero h1 { font-size: clamp(36px, 6vw, 64px); max-width: 16ch; }
.lede { font-size: 18px; color: var(--muted); max-width: 52ch; margin: 0 0 22px; }
.hero__ctas { display: flex; flex-wrap: wrap; gap: 12px; }
.glow { position: absolute; width: 320px; height: 320px; right: -80px; top: -80px; border-radius: 50%; background: radial-gradient(circle, rgba(200, 245, 96, .16), transparent 70%); pointer-events: none; }
@media (prefers-reduced-motion: no-preference) { .glow { animation: breathe 6s ease-in-out infinite alternate; } }
.haze { position: fixed; inset: 0; z-index: 0; pointer-events: none; background: radial-gradient(60% 40% at 20% 0%, rgba(200, 245, 96, .05), transparent 70%); }
@media (prefers-reduced-motion: no-preference) { .haze { animation: drift 14s ease-in-out infinite alternate; } }
@keyframes drift { from { transform: translateY(0); } to { transform: translateY(24px); } }
@keyframes breathe { from { transform: scale(1); opacity: .6; } to { transform: scale(1.2); opacity: 1; } }
${PAUSE_RULE}
@media (prefers-reduced-motion: no-preference) { .js [data-reveal]:not(.is-in) { opacity: 0; transform: translateY(16px); } .js [data-reveal] { transition: opacity .45s ease, transform .45s ease; } }
html[data-motion="paused"] [data-reveal] { opacity: 1 !important; transform: none !important; }
.rail { display: flex; gap: 16px; margin: 0; padding: 4px 16px; list-style: none; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: 16px; scrollbar-width: none; }
.rail > li { flex: 0 0 240px; scroll-snap-align: start; }
.card { display: block; height: 100%; overflow: hidden; border-radius: 18px; border: 1px solid var(--line); background: var(--card); text-decoration: none; }
.card img { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; }
.card h3 { font-size: 18px; margin: 12px 14px 4px; }
.card p { margin: 0 14px 14px; font-size: 15px; color: var(--muted); }
.rail-ctrl { display: flex; justify-content: flex-end; gap: 8px; max-width: 1200px; margin: 0 auto; padding: 12px 16px 0; }
.rail-btn { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 999px; border: 1px solid var(--line); background: #1c2a21; color: var(--ink); cursor: pointer; }
.rail-btn:disabled { opacity: .45; cursor: default; }
.weekly .rail > li { flex-basis: 220px; }
.day-card { display: flex; flex-direction: column; gap: 6px; width: 100%; min-height: 120px; padding: 16px; border-radius: 18px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.day-card__day { font-size: 14px; color: var(--muted); }
.day-card__name { font-size: 18px; font-weight: 700; }
.badge { align-self: flex-start; padding: 2px 8px; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-size: 12px; font-weight: 700; }
dialog.modal { max-width: min(92vw, 480px); padding: 24px; border-radius: 22px; border: 1px solid var(--line); background: #101a13; color: var(--ink); }
dialog.modal::backdrop { background: rgba(0, 0, 0, .6); }
.about__grid { display: grid; gap: 24px; align-items: center; }
@media (min-width: 768px) { .about__grid { grid-template-columns: 1fr 1fr; } }
.about p { font-size: 16px; color: var(--muted); }
figure { margin: 0; }
figure img { display: block; width: 100%; height: auto; border-radius: 18px; }
.intro p { font-size: 16px; color: var(--muted); max-width: 60ch; }
.form { max-width: 560px; }
.field { display: grid; gap: 6px; margin-bottom: 14px; }
.field label { font-size: 15px; }
.field input, .field textarea { min-height: 48px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(243, 239, 228, .45); background: #0f1912; color: var(--ink); font: inherit; }
.form-status { min-height: 24px; margin: 12px 0 0; font-size: 15px; }
.site-footer { padding: 48px 0 32px; border-top: 1px solid var(--line); }
.site-footer h2 { font-size: 18px; }
.site-footer p { color: var(--muted); margin: 0; }
.footer__grid { display: grid; gap: 24px; }
@media (min-width: 768px) { .footer__grid { grid-template-columns: repeat(3, 1fr); } }
.footer__links { list-style: none; margin: 0; padding: 0; }
.footer__links a { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; }
.dock { display: none; }
@media (max-width: 767px) { .dock { position: fixed; left: 8px; right: 8px; bottom: 8px; z-index: 30; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 6px; border-radius: 999px; border: 1px solid var(--line); background: rgba(16, 26, 19, .97); }
  .dock a { display: flex; align-items: center; justify-content: center; min-height: 48px; border-radius: 999px; font-size: 15px; font-weight: 700; text-decoration: none; }
  .dock .dock__primary { background: var(--accent); color: var(--accent-ink); } }
.age-gate { display: none; position: fixed; inset: 0; z-index: 90; place-items: center; padding: 16px; background: rgba(5, 9, 6, .94); }
html.gate-open .age-gate { display: grid; }
html.gate-open body { overflow: hidden; }
.age-gate__panel { max-width: 440px; padding: 28px; border-radius: 22px; background: #101a13; }
.age-gate__panel p { color: var(--muted); }
.age-gate__actions { display: flex; flex-wrap: wrap; gap: 12px; }
`;
const JS = `/* fixture site.js - lane T2 self-test fixture only (not the real site). Implements the build contract's hooks. */
(function () {
  'use strict';
  var d = document, html = d.documentElement, CFG = window.FIX || {};
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function focusables(root) { return $$(FOCUSABLE, root).filter(function (el) { return el.offsetWidth || el.offsetHeight || el.getClientRects().length; }); }
  function trap(root, e) { if (e.key !== 'Tab') return; var f = focusables(root); if (!f.length) return; var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (d.activeElement === first || !root.contains(d.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (d.activeElement === last || !root.contains(d.activeElement))) { e.preventDefault(); first.focus(); } }
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function nyNow() { var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    var get = function (t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : '0'; }; var h = parseInt(get('hour'), 10); if (h === 24) h = 0;
    return { day: Math.max(0, DAYS.indexOf(get('weekday'))), hour: h, minute: parseInt(get('minute'), 10) }; }
  function fmtHour(h) { return h === 0 || h === 24 ? '12AM' : h === 12 ? '12PM' : h < 12 ? h + 'AM' : (h - 12) + 'PM'; }
  function status() { var hrs = CFG.hours || []; var n = nyNow(); var t = hrs[n.day]; var m = n.hour * 60 + n.minute;
    if (t && m >= t[0] * 60 && m < t[1] * 60) { var left = t[1] * 60 - m; return { open: true, label: 'Open Now', detail: left <= 60 ? 'Closes in ' + left + ' min' : 'Open until ' + fmtHour(t[1]) }; }
    if (t && m < t[0] * 60) return { open: false, label: 'Closed', detail: 'Opens today at ' + fmtHour(t[0]) };
    for (var i = 1; i <= 7; i++) { var nx = hrs[(n.day + i) % 7]; if (nx) return { open: false, label: 'Closed', detail: 'Opens ' + (i === 1 ? 'tomorrow' : DAYS[(n.day + i) % 7]) + ' at ' + fmtHour(nx[0]) }; }
    return { open: false, label: 'Closed', detail: '' }; }
  function paint() { var s = status(); $$('[data-status]').forEach(function (el) { el.setAttribute('data-open', String(s.open)); var l = $('[data-status-label]', el), t = $('[data-status-detail]', el); if (l) l.textContent = s.label; if (t) t.textContent = '\\u00b7 ' + s.detail; }); }
  paint();
  function markToday() { var day = String(nyNow().day);
    $$('[data-day]').forEach(function (el) { var on = el.getAttribute('data-day') === day; if (on) el.setAttribute('data-today', ''); else el.removeAttribute('data-today'); var b = $('[data-today-badge]', el); if (b) b.hidden = !on; }); }
  markToday();
  var gate = $('#age-gate');
  if (gate) {
    if (html.classList.contains('gate-open')) setTimeout(function () { var y = $('[data-age-yes]', gate); if (y) y.focus(); }, 30);
    d.addEventListener('keydown', function (e) { if (html.classList.contains('gate-open')) trap(gate, e); });
    $('[data-age-yes]', gate).addEventListener('click', function () { store.set('sad-age-verified', JSON.stringify({ v: 1, at: Date.now() })); html.classList.remove('gate-open'); var m = $('#main'); if (m) m.focus({ preventScroll: true }); });
    $('[data-age-no]', gate).addEventListener('click', function () { window.location.href = 'https://google.com'; });
  }
  var drawer = $('#drawer'), toggle = $('.menu-toggle');
  function openDrawer() { drawer.hidden = false; toggle.setAttribute('aria-expanded', 'true'); d.body.classList.add('no-scroll'); setTimeout(function () { var f = focusables($('.drawer__panel', drawer)); (f[0] || drawer).focus(); }, 40); }
  function closeDrawer() { if (drawer.hidden) return; drawer.hidden = true; toggle.setAttribute('aria-expanded', 'false'); d.body.classList.remove('no-scroll'); toggle.focus(); }
  if (drawer && toggle) {
    toggle.addEventListener('click', function () { if (toggle.getAttribute('aria-expanded') === 'true') closeDrawer(); else openDrawer(); });
    $$('[data-drawer-close]', drawer).forEach(function (b) { b.addEventListener('click', closeDrawer); });
    d.addEventListener('keydown', function (e) { if (drawer.hidden) return; if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; } trap($('.drawer__panel', drawer), e); });
  }
  function setMotion(p, persist) { if (p) html.setAttribute('data-motion', 'paused'); else html.removeAttribute('data-motion');
    $$('[data-motion-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', p ? 'true' : 'false'); var lab = b.getAttribute(p ? 'data-label-play' : 'data-label-pause'); b.setAttribute('aria-label', lab); var t = $('[data-motion-text]', b); if (t) t.textContent = lab; });
    if (persist) store.set('sad-motion', p ? 'paused' : 'on'); }
  setMotion(html.getAttribute('data-motion') === 'paused', false);
  $$('[data-motion-toggle]').forEach(function (b) { b.addEventListener('click', function () { setMotion(html.getAttribute('data-motion') !== 'paused', true); }); });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  /*REVEAL*/
  var reveals = $$('[data-reveal]');
  if (!('IntersectionObserver' in window) || reduce.matches) reveals.forEach(function (el) { el.classList.add('is-in'); });
  else { var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }); }, { threshold: 0.01 }); reveals.forEach(function (el) { io.observe(el); }); }
  /*END REVEAL*/
  $$('[data-carousel]').forEach(function (c) { var rail = $('[data-rail]', c), prev = $('[data-prev]', c), next = $('[data-next]', c); if (!rail) return;
    function sync() { var max = rail.scrollWidth - rail.clientWidth - 2; var over = max > 0; if (prev) prev.disabled = !over || rail.scrollLeft <= 2; if (next) next.disabled = !over || rail.scrollLeft >= max; }
    function go(dir) { rail.scrollBy({ left: dir * rail.clientWidth * 0.8, behavior: reduce.matches ? 'auto' : 'smooth' }); }
    if (prev) prev.addEventListener('click', function () { go(-1); }); if (next) next.addEventListener('click', function () { go(1); });
    rail.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true }); window.addEventListener('resize', sync); sync(); });
  $$('[data-dialog]').forEach(function (btn) { var dlg = d.getElementById(btn.getAttribute('data-dialog')); if (!dlg || !dlg.showModal) return;
    btn.addEventListener('click', function () { dlg.showModal(); });
    $$('[data-dialog-close]', dlg).forEach(function (x) { x.addEventListener('click', function () { dlg.close(); }); });
    dlg.addEventListener('close', function () { btn.focus(); }); });
  $$('form[data-api]').forEach(function (form) { var out = $('[data-form-status]', form), btn = $('button[type=submit]', form);
    form.addEventListener('submit', function (e) { e.preventDefault(); if (!form.reportValidity()) return;
      var data = {}; $$('[name]', form).forEach(function (f) { var v = (f.value || '').trim(); if (v !== '') data[f.name] = v; });
      try { var x = JSON.parse(form.getAttribute('data-extra') || '{}'); for (var k in x) data[k] = x[k]; } catch (er) {}
      out.textContent = form.getAttribute('data-msg-sending'); btn.disabled = true;
      fetch(form.getAttribute('data-api'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) { if (!res.ok) { out.textContent = form.getAttribute('data-msg-error'); return; } out.textContent = form.getAttribute('data-msg-success'); form.reset(); })
        .catch(function () { out.textContent = form.getAttribute('data-msg-network'); })
        .then(function () { btn.disabled = false; }); }); });
})();
`;
const head = (rel, title) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><link rel="icon" href="data:,">
<script>(function(){var d=document.documentElement;d.classList.add('js');try{var v=JSON.parse(localStorage.getItem('sad-age-verified')||'null');if(!(v&&v.v===1&&Date.now()-v.at<2592e6))d.classList.add('gate-open');if(localStorage.getItem('sad-motion')==='paused')d.setAttribute('data-motion','paused')}catch(e){d.classList.add('gate-open')}})();</script>
<script>window.FIX={"hours":[[10,20],[9,20],[9,20],[9,20],[9,20],[9,20],[9,20]]};</script>
<link rel="stylesheet" href="${rel}assets/site.css"></head>
<body>`;
const status = '<p class="status" data-status aria-live="polite"><span data-status-label>Open Now</span> <span data-status-detail></span></p>';
const top = (rel, cur) => `<a class="skip-link" href="#main">Skip to content</a>
<div class="haze" aria-hidden="true"></div>
<header class="site-header"><div class="site-header__in">
 <a class="brand" href="${rel}">Fixture</a>
 <nav class="nav-primary" aria-label="Primary"><a href="${rel}"${cur === 'home' ? ' aria-current="page"' : ''}>Home</a><a href="${rel}contact/"${cur === 'contact' ? ' aria-current="page"' : ''}>Contact</a></nav>
 ${status}
 <button type="button" class="icon-btn" data-motion-toggle aria-pressed="false" aria-label="Pause motion" data-label-pause="Pause motion" data-label-play="Play motion">${I_PAUSE}</button>
 <a class="btn btn--primary btn--sm hdr-shop" href="${rel}shop/" data-shop-now>Shop Now</a>
 <button type="button" class="icon-btn menu-toggle" aria-controls="drawer" aria-expanded="false" aria-label="Open menu">${I_MENU}</button>
</div></header>
<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Menu" hidden><div class="drawer__scrim" data-drawer-close></div><div class="drawer__panel">
 <button type="button" class="icon-btn" data-drawer-close aria-label="Close menu">${I_X}</button>
 ${status}
 <a class="btn btn--primary" href="${rel}shop/" data-shop-now>Shop Now</a>
 <nav class="drawer__nav" aria-label="Menu"><a href="${rel}">Home</a><a href="${rel}contact/">Contact</a></nav>
</div></div>`;
const bottom = (rel) => `<footer class="site-footer"><div class="wrap footer__grid">
 <div><h2>Visit</h2><p>1 Fixture Street, Testville</p></div>
 <div><h2>Links</h2><ul class="footer__links"><li><a href="${rel}">Home</a></li><li><a href="${rel}contact/">Contact</a></li></ul></div>
 <div><h2>Motion</h2><button type="button" class="btn btn--ghost" data-motion-toggle aria-pressed="false" aria-label="Pause motion" data-label-pause="Pause motion" data-label-play="Play motion"><span data-motion-text>Pause motion</span></button></div>
</div></footer>
<nav class="dock" aria-label="Quick actions"><a href="${rel}#weekly">Deals</a><a class="dock__primary" href="${rel}shop/" data-shop-now>Shop Now</a><a href="https://maps.example.com/">Directions</a></nav>
<div class="age-gate" id="age-gate" role="dialog" aria-modal="true" aria-labelledby="ag-t" aria-describedby="ag-d"><div class="age-gate__panel">
 <h2 id="ag-t">Are you 21 or older?</h2><p id="ag-d">You must be 21 or older to enter this fixture.</p>
 <div class="age-gate__actions"><button type="button" class="btn btn--ghost" data-age-no>No</button><button type="button" class="btn btn--primary" data-age-yes>Yes, I am 21+</button></div>
</div></div>
<script src="${rel}assets/site.js" defer></script>
</body></html>
`;
const DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEAL = ['Sunday Funday', 'Munchie Monday', 'Terp Tuesday', 'Wax Wednesday', 'Thirsty Thursday', 'Flower Friday', 'Self-care Saturday'];
const carouselCtl = `<div class="rail-ctrl"><button type="button" class="rail-btn" data-prev aria-label="Previous">${I_L}</button><button type="button" class="rail-btn" data-next aria-label="Next">${I_R}</button></div>`;
const HOME = head('', 'Fixture home') + top('', 'home') + `
<main id="main" tabindex="-1">
<section class="hero" data-hero id="top" aria-labelledby="hero-t"><span class="glow" aria-hidden="true"></span><div class="wrap">
 <p class="eyebrow">Fixture, Testville</p>
 <h1 id="hero-t">A tiny dark fixture site</h1>
 <p class="lede">It follows the build contract's hooks so the rendered gate has something honest to measure.</p>
 <div class="hero__ctas"><a class="btn btn--primary" href="shop/" data-primary-cta>Shop the menu</a><a class="btn btn--ghost" href="contact/">Contact us</a></div>
</div></section>
<section class="cats" id="categories" aria-labelledby="cats-t"><div class="wrap"><h2 id="cats-t" data-reveal>Categories</h2></div>
 <div class="carousel" data-carousel><ul class="rail" data-rail role="list">
${[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `  <li data-reveal><a class="card" href="contact/"><img src="assets/img/cat-${i % 2 ? 'a' : 'b'}.svg" width="480" height="360" alt="Category ${i} artwork" loading="lazy"><h3>Category ${i}</h3><p>Short line ${i}</p></a></li>`).join('\n')}
 </ul>${carouselCtl}</div>
</section>
<section class="weekly" id="weekly" aria-labelledby="weekly-t"><div class="wrap"><h2 id="weekly-t">Weekly specials</h2></div>
 <div class="carousel" data-carousel><ul class="rail" data-rail role="list">
${[1, 2, 3, 4, 5, 6, 0].map((d) => `  <li class="day" data-day="${d}" data-reveal><button type="button" class="day-card" data-dialog="deal-${d}" aria-haspopup="dialog"><span class="day-card__day">${DAYN[d]}</span><span class="day-card__name" data-deal-name>${DEAL[d]}</span><span class="badge" data-today-badge hidden>Today</span></button>
   <dialog class="modal" id="deal-${d}" aria-labelledby="deal-${d}-t"><h3 id="deal-${d}-t">${DEAL[d]}</h3><p>Details for ${DAYN[d]}: a fixture deal with enough words to read as a sentence.</p><button type="button" class="btn btn--ghost" data-dialog-close>Close</button></dialog></li>`).join('\n')}
 </ul>${carouselCtl}</div>
</section>
<section class="about" id="about" aria-labelledby="about-t"><div class="wrap about__grid">
 <div class="about__text" data-reveal><h2 id="about-t">About the fixture</h2>
  <p>This paragraph is running text, long enough to be judged by the type-size rule, with an <a href="contact/">inline link</a> that sits inside the sentence.</p></div>
 <figure data-reveal><img src="assets/img/photo.png" width="480" height="320" alt="A dark green gradient"></figure>
</div></section>
</main>
` + bottom('');
const CONTACT = head('../', 'Fixture contact') + top('../', 'contact') + `
<main id="main" tabindex="-1">
<section class="intro" id="intro" aria-labelledby="intro-t"><div class="wrap"><h1 id="intro-t">Contact the fixture</h1>
 <p>Send the fixture a message with the form below; it posts JSON to the same endpoint the live site uses.</p></div></section>
<section class="contact" id="contact-form" aria-labelledby="form-t"><div class="wrap"><h2 id="form-t">Send a message</h2>
 <form class="form" data-api="/api/contact" data-extra='{"site":"sfd"}' data-msg-sending="Sending your message..." data-msg-success="Thanks, we got your message." data-msg-error="Something went wrong. Please try again." data-msg-network="Network error. Please try again.">
  <div class="field"><label for="f-name">Name</label><input id="f-name" name="name" type="text" required autocomplete="name"></div>
  <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" required autocomplete="email"></div>
  <div class="field"><label for="f-phone">Phone (optional)</label><input id="f-phone" name="phone" type="tel" autocomplete="tel"></div>
  <div class="field"><label for="f-msg">Message</label><textarea id="f-msg" name="message" required rows="4"></textarea></div>
  <button type="submit" class="btn btn--primary">Send message</button>
  <p class="form-status" data-form-status aria-live="polite"></p>
 </form></div></section>
</main>
` + bottom('../');

function writeFixture(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'assets/img'), { recursive: true }); fs.mkdirSync(path.join(dir, 'contact'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), HOME); fs.writeFileSync(path.join(dir, 'contact/index.html'), CONTACT);
  fs.writeFileSync(path.join(dir, 'assets/site.css'), CSS); fs.writeFileSync(path.join(dir, 'assets/site.js'), JS);
  fs.writeFileSync(path.join(dir, 'assets/img/cat-a.svg'), svgArt('#1d3b26', '#0d1a11', '#2c5a39'));
  fs.writeFileSync(path.join(dir, 'assets/img/cat-b.svg'), svgArt('#2a2414', '#110f08', '#4a3f1f'));
  fs.writeFileSync(path.join(dir, 'assets/img/photo.png'), makePng(480, 320, (x, y) => [12 + Math.round(18 * x / 480), 30 + Math.round(40 * y / 320), 18 + Math.round(10 * x / 480)]));
}

// ------------------------------------------------------------------ mutants (one exact edit each)
const MUTANTS = [
  { id: 'R1-overflow', rule: 'R1', page: 'home', vp: '390x844', why: 'a 640px block inside a 390px page', css: '.about__text { min-width: 640px; }' },
  { id: 'R1-cut-by-body-clip', rule: 'R1', page: 'home', vp: '390x844', why: 'html/body overflow-x:clip hides the scroll; the 640px block is cut at the edge', css: 'html, body { overflow-x: clip; } .about__text { min-width: 640px; }', expect: /past the viewport's right edge/ },
  { id: 'R2-hero-taller-than-screen', rule: 'R2', page: 'home', vp: '1440x900', why: 'hero min-height 130vh', css: '.hero { min-height: 130vh; }' },
  { id: 'R3-section-too-tall', rule: 'R3', page: 'home', vp: '1440x900', why: 'a 1400px section at 1440x900', css: '.about { min-height: 1400px; }' },
  { id: 'R4-30px-phone-button', rule: 'R4', page: 'home', vp: '390x844', why: 'menu toggle 30x30 on a phone', css: '.menu-toggle { width: 30px !important; height: 30px !important; }' },
  { id: 'R5-777-on-888', rule: 'R5', page: 'home', vp: '1440x900', why: '#777 text on #888', css: '.about p { color: #777 !important; background: #888 !important; }' },
  { id: 'R6-img-without-height', rule: 'R6', page: 'home', vp: '1440x900', why: 'photo loses its height attribute', html: ['index.html', 'width="480" height="320" alt="A dark green gradient"', 'width="480" alt="A dark green gradient"'] },
  { id: 'R7-two-h1', rule: 'R7', page: 'home', vp: '1440x900', why: 'a second h1', html: ['index.html', '<h2 id="weekly-t">Weekly specials</h2>', '<h1 id="weekly-t">Weekly specials</h1>'] },
  { id: 'R8-12px-paragraph', rule: 'R8', page: 'home', vp: '1440x900', why: 'running text at 12px', css: '.about p { font-size: 12px !important; }' },
  { id: 'R9-console-error', rule: 'R9', page: 'home', vp: '1440x900', why: 'console.error at load', jsAppend: "console.error('mutant: boom');" },
  { id: 'R10-outline-none', rule: 'R10', page: 'home', vp: '1440x900', why: 'outline:none with no replacement', css: ':focus, :focus-visible { outline: none !important; }' },
  { id: 'R10-skip-link-never-shows', rule: 'R10', page: 'home', vp: '390x844', why: 'the focused skip link stays above the viewport', css: '.skip-link:focus { top: -120px !important; }', expect: /skip link is focused but not shown/ },
  { id: 'R10-nothing-to-tab-to', rule: 'R10', page: 'home', vp: '1440x900', why: 'only the skip link is focusable (count 0 must FAIL)', jsAppend: "document.querySelectorAll('a, button, input, textarea, select, [data-rail]').forEach(function (e) { if (!e.classList.contains('skip-link')) e.setAttribute('tabindex', '-1'); });", expect: /measured 0 items/ },
  { id: 'F1-yes-not-stored', rule: 'F1', page: 'home', vp: '1440x900', why: 'gate Yes does not write sad-age-verified', js: ["store.set('sad-age-verified', JSON.stringify({ v: 1, at: Date.now() })); ", ''] },
  { id: 'F2-escape-ignored', rule: 'F2', page: 'home', vp: '390x844', why: 'Escape does not close the drawer', js: ["if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; }", "if (e.key === 'Escape') { e.preventDefault(); return; }"] },
  { id: 'F2-page-scrolls-under-drawer', rule: 'F2', page: 'home', vp: '390x844', why: 'the body is not locked while the drawer is open', js: ["d.body.classList.add('no-scroll'); ", ''], expect: /not locked/ },
  { id: 'F3-no-reachable-shop-link', rule: 'F3', page: 'home', vp: '390x844', why: 'the dock is gone and the header has no shop link on phones', css: '.dock { display: none !important; }' },
  { id: 'F4-pause-not-pausing', rule: 'F4', page: 'home', vp: '1440x900', why: 'the pause rule is gone', cssReplace: [PAUSE_RULE, ''] },
  { id: 'F5-next-does-nothing', rule: 'F5', page: 'home', vp: '1440x900', why: '[data-next] loses its click handler', jsAppend: "document.querySelectorAll('[data-next]').forEach(function (b) { b.replaceWith(b.cloneNode(true)); });" },
  { id: 'F6-wrong-today', rule: 'F6', page: 'home', vp: '1440x900', why: 'today index off by one', js: ['var day = String(nyNow().day);', 'var day = String((nyNow().day + 1) % 7);'] },
  { id: 'F7-wrong-wording', rule: 'F7', page: 'home', vp: '390x844', why: '"Open till" instead of the live "Open until"', js: ["'Open until '", "'Open till '"] },
  { id: 'F8-wrong-payload-key', rule: 'F8', page: 'contact/', vp: '1440x900', why: 'message field posted as msg', html: ['contact/index.html', 'name="message"', 'name="msg"'] },
  { id: 'F9-reveal-stuck', rule: 'F9', page: 'home', vp: '1440x900', why: 'reveals never get .is-in under motion', jsRe: [/\/\*REVEAL\*\/[\s\S]*?\/\*END REVEAL\*\//, '/* reveal removed */'] },
  { id: 'F10-dialog-never-opens', rule: 'F10', page: 'home', vp: '390x844', why: 'day cards lose showModal', js: ["btn.addEventListener('click', function () { dlg.showModal(); });", "btn.addEventListener('click', function () { });"] },
];
const AXE_MUTANTS = [
  { id: 'AXE-image-alt', expectId: 'image-alt', page: 'home', vp: '1440x900', html: ['index.html', ' alt="A dark green gradient"', ''] },
  { id: 'AXE-button-name', expectId: 'button-name', page: 'home', vp: '390x844', html: ['index.html', ' aria-label="Open menu"', ''] },
];
function buildMutant(m) {
  const dir = path.join(MUTS, m.id); writeFixture(dir);
  const rep = (rel, from, to) => { const f = path.join(dir, rel); const s = fs.readFileSync(f, 'utf8'); const t = from instanceof RegExp ? s.replace(from, to) : s.split(from).join(to); if (t === s) throw new Error(`mutation "${m.id}" changed nothing in ${rel} (stale anchor)`); fs.writeFileSync(f, t); };
  if (m.css) fs.appendFileSync(path.join(dir, 'assets/site.css'), '\n/* MUTANT */ ' + m.css + '\n');
  if (m.cssReplace) rep('assets/site.css', m.cssReplace[0], m.cssReplace[1]);
  if (m.html) rep(m.html[0], m.html[1], m.html[2]);
  if (m.js) rep('assets/site.js', m.js[0], m.js[1]);
  if (m.jsRe) rep('assets/site.js', m.jsRe[0], m.jsRe[1]);
  if (m.jsAppend) fs.appendFileSync(path.join(dir, 'assets/site.js'), '\n/* MUTANT */ ;(function () { ' + m.jsAppend + ' })();\n');
  return dir;
}

// ------------------------------------------------------------------ child runner (watchdog + one retry)
function runChild(script, args, watchdogS, label) {
  const full = [script, ...args, '--watchdog', String(watchdogS), ...(UNLOCKED ? ['--unlocked'] : [])];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, full, { cwd: ROOT, encoding: 'utf8', env: process.env, timeout: (watchdogS + 90) * 1000, killSignal: 'SIGKILL', maxBuffer: 1 << 26 });
    const secs = Math.round((Date.now() - t0) / 1000); const out = (r.stdout || '') + (r.stderr || '');
    const hung = r.status === 3 || r.status === null || (r.error && r.error.code === 'ETIMEDOUT');
    if (!hung) return { code: r.status, out, secs, attempts: attempt };
    console.log(`   .. ${label}: attempt ${attempt} ${r.status === 3 ? 'ended by its watchdog (exit 3)' : 'killed by the spawn timeout'} after ${secs}s${attempt === 1 ? ' - retrying once' : ' - giving up'}`);
    if (attempt === 2) return { code: r.status, out, secs, attempts: attempt, hung: true };
  }
}
const lastLines = (s, n) => s.trim().split('\n').slice(-n).join('\n');

// ------------------------------------------------------------------ main
fs.mkdirSync(OUTS, { recursive: true });
writeFixture(CLEAN);
const only = opt('cases', '') ? opt('cases', '').split(',') : null;
const results = []; let bad = 0;
const record = (r) => { results.push(r); if (!r.ok) bad++; console.log(`${r.ok ? 'ok  ' : 'MISS'} ${r.case}: ${r.detail}`); };

if (!has('no-clean') && !only) {
  console.log('-- clean fixture through check.mjs (home + contact/ at 1440x900 and 390x844, every rule)');
  const json = path.join(OUTS, 'clean.json');
  const r = runChild(CHECK, ['--dir', CLEAN, '--paths', 'home,contact/', '--vp', '1440x900,390x844', '--json', json], 1200, 'clean');
  let rep = null; try { rep = JSON.parse(fs.readFileSync(json, 'utf8')); } catch (e) {}
  const cov = {}; if (rep) for (const run of rep.runs) for (const [id, x] of Object.entries(run.rules)) { cov[id] ||= { pass: 0, fail: 0, count: 0 }; if (x.status === 'PASS') { cov[id].pass++; cov[id].count += x.count; } if (x.status === 'FAIL') cov[id].fail++; }
  const uncovered = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10'].filter((id) => !cov[id] || !cov[id].pass || !cov[id].count);
  const ok = !r.hung && r.code === 0 && rep && rep.summary && rep.summary.pass && !uncovered.length;
  record({ case: 'clean check.mjs', ok, code: r.code, secs: r.secs, detail: `exit ${r.code} in ${r.secs}s; ${rep ? Object.entries(cov).map(([id, c]) => `${id}:${c.pass}p/${c.fail}f/${c.count}`).join(' ') : 'no report'}${uncovered.length ? '; NOT exercised: ' + uncovered.join(',') : ''}`, tail: lastLines(r.out, ok ? 4 : 60) });
  if (!ok) console.log(lastLines(r.out, 60));
}
for (const m of MUTANTS) {
  if (only && !only.includes(m.id)) continue;
  let dir; try { dir = buildMutant(m); } catch (e) { record({ case: m.id, ok: false, detail: e.message }); continue; }
  const json = path.join(OUTS, m.id + '.json'); try { fs.rmSync(json); } catch (e) {}
  const r = runChild(CHECK, ['--dir', dir, '--paths', m.page, '--vp', m.vp, '--only', m.rule, '--json', json], 420, m.id);
  let rep = null; try { rep = JSON.parse(fs.readFileSync(json, 'utf8')); } catch (e) {}
  const x = rep && rep.runs && rep.runs[0] && rep.runs[0].rules[m.rule];
  const real = x ? x.fails.filter((f) => f.sel !== 'tool') : [];
  const matched = !m.expect || real.some((f) => m.expect.test(f.msg));
  const ok = !r.hung && r.code === 1 && x && x.status === 'FAIL' && real.length > 0 && matched;
  record({ case: m.id, rule: m.rule, ok, code: r.code, secs: r.secs, detail: `${m.why} @${m.page} ${m.vp}: ${r.hung ? 'HUNG twice (not proven)' : `exit ${r.code}, ${m.rule} ${x ? x.status : 'absent'}`}${real[0] ? ' - ' + (real[0].sel + ': ' + real[0].msg).slice(0, 170) : x && x.fails[0] ? ' - TOOL CRASH ' + x.fails[0].msg.slice(0, 120) : ''}${!matched ? ` (expected a failure matching ${m.expect})` : ''}`, tail: ok ? undefined : lastLines(r.out, 30) });
  if (!ok) console.log(lastLines(r.out, 30));
}
if (!has('no-axe')) {
  if (!only) {
    console.log('-- clean fixture through a11y-axe.mjs');
    const json = path.join(OUTS, 'axe-clean.json');
    const r = runChild(AXE, ['--dir', CLEAN, '--paths', 'home,contact/', '--vp', '1440x900,390x844', '--json', json], 600, 'axe clean');
    let rep = null; try { rep = JSON.parse(fs.readFileSync(json, 'utf8')); } catch (e) {}
    const groups = rep ? rep.scans.reduce((t, s) => t + s.violations.length, 0) : -1;
    const ok = !r.hung && r.code === 0 && rep && rep.scans.length === 6 && rep.scans.every((s) => s.rulesRun > 0);
    record({ case: 'clean a11y-axe.mjs', ok, code: r.code, secs: r.secs, detail: `exit ${r.code} in ${r.secs}s; ${rep ? rep.scans.length + ' scans, rules run ' + rep.scans.map((s) => s.rulesRun).join('/') + ', violation groups (any impact) ' + groups : 'no report'}`, tail: lastLines(r.out, ok ? 3 : 40) });
    if (!ok) console.log(lastLines(r.out, 40));
  }
  for (const m of AXE_MUTANTS) {
    if (only && !only.includes(m.id)) continue;
    let dir; try { dir = buildMutant(m); } catch (e) { record({ case: m.id, ok: false, detail: e.message }); continue; }
    const json = path.join(OUTS, m.id + '.json');
    const r = runChild(AXE, ['--dir', dir, '--paths', m.page, '--vp', m.vp, '--no-gate', '--json', json], 300, m.id);
    let rep = null; try { rep = JSON.parse(fs.readFileSync(json, 'utf8')); } catch (e) {}
    const v = rep ? rep.scans.flatMap((s) => s.violations).find((x) => x.id === m.expectId) : null;
    const ok = !r.hung && r.code === 1 && !!v && ['serious', 'critical'].includes(v.impact);
    record({ case: m.id, ok, code: r.code, secs: r.secs, detail: `exit ${r.code}; ${v ? `${v.id} [${v.impact}] at ${v.nodes[0].target}` : 'expected violation ' + m.expectId + ' not reported'}` });
  }
}
if (!results.length) record({ case: 'nothing ran', ok: false, detail: 'no case matched (--cases filter?) - a self-test of nothing is not a pass' });
const nMut = results.filter((r) => r.rule || r.case.startsWith('AXE-')).length; const caught = results.filter((r) => (r.rule || r.case.startsWith('AXE-')) && r.ok).length;
fs.writeFileSync(path.join(LAB, 'selftest.json'), JSON.stringify({ tool: 'check-selftest.mjs', at: new Date().toISOString(), lockSlot: process.env.BROWSER_LOCK_SLOT || null, pass: !bad, mutants: nMut, caught, results }, null, 1));
console.log(bad ? `\ncheck self-test: FAIL (${bad} case(s) not proven; mutants caught ${caught}/${nMut})` : `\ncheck self-test: PASS (${results.filter((r) => r.case.startsWith('clean')).length} clean run(s) pass; ${caught}/${nMut} mutants caught)`);
process.exit(bad ? 1 : 0);
