/* contact.js — the contact page's one behaviour: show a focus ring on the map frame while keyboard focus is inside the
   embedded Google map. Focus moving into a cross-origin iframe blurs the window and leaves document.activeElement on the
   iframe; the iframe itself does not reliably match :focus, so the frame gets .is-focus instead. */
(function () {
  'use strict';
  var map = document.querySelector('.ct-map iframe');
  if (!map) return;
  var frame = map.parentNode;
  function sync() { setTimeout(function () { frame.classList.toggle('is-focus', document.activeElement === map); }, 0); }
  window.addEventListener('blur', sync);
  window.addEventListener('focus', sync);
  document.addEventListener('focusin', sync);
})();
