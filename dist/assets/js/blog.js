/* blog.js — lane blog, the /blog listing only. site.js filters the cards; this re-syncs the swipe rail afterwards:
   back to the first card, and a scroll event so site.js recomputes the arrows' disabled state and data-overflow.
   (sharedChangeRequest: site.js could do this itself for any rail inside a filter scope.) */
(function () {
  'use strict';
  var sec = document.getElementById('posts');
  if (!sec) return;
  sec.addEventListener('filter', function () {
    var rail = sec.querySelector('[data-rail]');
    if (!rail) return;
    rail.scrollLeft = 0;
    rail.dispatchEvent(new Event('scroll'));
  });
})();
