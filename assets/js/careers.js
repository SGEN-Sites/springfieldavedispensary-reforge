/* careers.js — "Apply Now" (on a role card or inside its Details dialog) jumps to the application form with that role
   preselected (live behaviour). Progressive: each one is a real link to #apply, so without this script it still
   reaches the form. Inside an open dialog the dialog is closed first; the jump runs on its 'close' event, after
   site.js has returned focus to the card's Details button, so that focus move cannot pull the page back up. */
(function () {
  'use strict';
  var d = document, html = d.documentElement;
  var sel = d.getElementById('careers-role'), form = d.getElementById('apply');
  if (!sel || !form) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var still = function () { return reduce.matches || html.getAttribute('data-motion') === 'paused'; };
  function go(role) {
    var known = Array.prototype.some.call(sel.options, function (o) { return o.value === role; });
    if (role && known) sel.value = role;
    /* a jump skips the scroll reveal of the form: show it now */
    Array.prototype.forEach.call(form.querySelectorAll('[data-reveal]'), function (el) { el.classList.add('is-in'); });
    form.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
    sel.classList.remove('is-picked'); void sel.offsetWidth; if (role && known) sel.classList.add('is-picked');
    setTimeout(function () { try { sel.focus({ preventScroll: true }); } catch (er) { sel.focus(); } }, still() ? 0 : 480);
  }
  Array.prototype.forEach.call(d.querySelectorAll('[data-apply-role]'), function (a) {
    a.addEventListener('click', function (e) {
      var role = a.getAttribute('data-apply-role') || '';
      var dlg = a.closest('dialog');
      e.preventDefault();
      if (dlg && dlg.open) {
        dlg.addEventListener('close', function () { go(role); }, { once: true });
        dlg.close();
      } else go(role);
    });
  });
  sel.addEventListener('change', function () { sel.classList.remove('is-picked'); });
})();
