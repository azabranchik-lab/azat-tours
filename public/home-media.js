// Homepage media driven by window.SITE (managed from the Telegram bot).
// Graceful: only overrides the hardcoded HTML when data is actually present,
// so the page still looks right if site-data.js is empty/missing.
(function () {
  var S = window.SITE || {};

  // ---- Instagram "Follow the journey" grid ----
  var ig = S.instagram || {};
  var url = ig.url || '';
  var photos = Array.isArray(ig.photos) ? ig.photos.filter(Boolean) : [];
  var grid = document.querySelector('#instagram .ig-grid');
  var icon = '<span class="ig-ic"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1"/></svg></span>';

  if (grid && photos.length) {
    grid.innerHTML = photos.map(function (src) {
      var href = url ? ' href="' + url + '" target="_blank" rel="noopener"' : ' href="#" onclick="return false"';
      return '<a class="ig-card"' + href + '><img loading="lazy" src="' + src + '" alt="Azat Tours on Instagram">' + icon + '</a>';
    }).join('');
  }
  if (url) {
    var headBtn = document.querySelector('#instagram .ig-head a');
    if (headBtn) headBtn.href = url;
    document.querySelectorAll('#instagram .ig-card').forEach(function (a) { a.href = url; });
  }

  // ---- Experience cards (images only; titles & links stay in HTML) ----
  var exps = Array.isArray(S.experiences) ? S.experiences : [];
  document.querySelectorAll('#experiences .exp-card').forEach(function (card, i) {
    if (exps[i]) { var im = card.querySelector('img'); if (im) im.src = exps[i]; }
  });

  // ---- Hero background ----
  if (S.hero) { var hero = document.querySelector('.hero-bg img'); if (hero) hero.src = S.hero; }

  // ---- Builder teaser (4 shots) ----
  var builder = Array.isArray(S.builder) ? S.builder : [];
  document.querySelectorAll('#builderShots img').forEach(function (im, i) {
    if (builder[i]) im.src = builder[i];
  });
})();
