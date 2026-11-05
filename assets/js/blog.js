/* blog.js — lane blog, the /blog listing only. site.js filters the cards ([data-filter-group] sets [hidden] on the cards
   outside the chosen category, then fires "filter"); this pages the result: the first page-size cards of the current
   category show, the live "Load More" button reveals the next page and moves focus to the first newly shown card.
   Without JS every card shows and the button stays hidden (progressive enhancement). */
(function () {
  'use strict';
  var sec = document.getElementById('posts');
  if (!sec) return;
  var grid = sec.querySelector('[data-page-size]');
  var btn = sec.querySelector('[data-load-more]');
  if (!grid) return;
  var size = parseInt(grid.getAttribute('data-page-size'), 10) || 0;
  var limit = size;
  var cat = '';
  var inCat = function (it) { return !cat || (it.getAttribute('data-cat') || '').split(' ').indexOf(cat) >= 0; };
  var apply = function () {
    var items = grid.querySelectorAll('[data-filter-item]');
    var shown = 0, total = 0;
    for (var k = 0; k < items.length; k++) {
      var on = inCat(items[k]);
      if (on) total++;
      var vis = on && (!size || shown < limit);
      if (vis) shown++;
      items[k].hidden = !vis;
    }
    if (btn) btn.hidden = !size || total <= limit;
  };
  sec.addEventListener('filter', function (e) { cat = (e.detail && e.detail.cat) || ''; limit = size; apply(); });
  if (btn) btn.addEventListener('click', function () {
    var before = grid.querySelectorAll('[data-filter-item]:not([hidden])').length;
    limit += size;
    apply();
    var next = grid.querySelectorAll('[data-filter-item]:not([hidden])')[before];
    var a = next && next.querySelector('a');
    if (a) a.focus({ preventScroll: false });
  });
  apply();
})();
