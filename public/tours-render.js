// Behaviour for the tour lists. The server sends the cards in the HTML
// (lib/pages.js + cards.js); this script adds filters, sorting and the rise-in.
// Everything is read from the cards themselves (data-cats / data-tags / data-days),
// so the page does not need the tours data file.
// Used on /tours/ (full catalog + filters) and the home page (featured grid).
// The filter toolbar markup lives in cards.js (Cards.catalogToolbar): the server puts
// it in the HTML so nothing jumps on load; this script only wires it up, and builds
// it itself when a page arrives without it.
(function () {
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // soft rise-in for a set of cards (stagger capped so long lists don't crawl)
  function riseIn(els) {
    if (reduceMotion) return;
    els.forEach(c => c.classList.remove('animate-in'));
    if (els[0]) void els[0].offsetWidth;                      // reflow → restart animation
    els.forEach((c, i) => { c.style.animationDelay = (Math.min(i, 8) * 35) + 'ms'; c.classList.add('animate-in'); });
  }

  // ---- FEATURED (home) ----
  const featured = document.getElementById('featuredGrid');
  if (featured) riseIn([...featured.querySelectorAll('.tour')]);

  // ---- CATALOG (tours.html) ----
  const grid = document.getElementById('toursGrid');
  if (grid) {
    const cards = [...grid.querySelectorAll('.tour')];
    const noRes = document.querySelector('.no-result');
    const bar = document.getElementById('filterBar');
    const C = window.Cards;

    let activeCat = 'all';
    const activeTags = new Set();

    function applyFilters() {
      let shown = 0;
      cards.forEach(c => {
        const cats = (c.dataset.cats || '').split('|');
        const tags = (c.dataset.tags || '').split('|');
        const catOk = activeCat === 'all' || cats.includes(activeCat);
        const tagOk = [...activeTags].every(t => tags.includes(t));
        const match = catOk && tagOk;
        c.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      if (noRes) noRes.classList.toggle('show', shown === 0);
    }

    if (bar && C) {
      const items = cards.map(c => ({ cats: (c.dataset.cats || '').split('|'), tags: (c.dataset.tags || '').split('|') }));
      const main = grid.closest('.catalog-main');
      const el = html => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };

      // toolbar: normally already in the HTML (server); otherwise build the same markup here
      if (!main.querySelector('.dfilters')) {
        const tb = C.catalogToolbar(items);
        bar.innerHTML = tb.bar;
        main.insertBefore(el(tb.dfilters), bar);   // above the mobile #filterBar, i.e. above the grid
        main.insertBefore(el(tb.mtoolbar), grid);
      }
      const mBtn = document.getElementById('mFilterBtn');

      // mobile bottom-sheet: Type (categories, single-select) + tag filters, grouped
      const sheet = document.createElement('div');
      sheet.id = 'filterSheet'; sheet.className = 'filter-sheet';
      sheet.innerHTML = C.filterSheet(items);
      document.body.appendChild(sheet);

      const present = C.CAT_ORDER.filter(c => items.some(i => i.cats.includes(c)));

      // ---- shared state (one source of truth for both desktop chips and the sheet) ----
      function syncUI() {
        document.querySelectorAll('[data-f]').forEach(c => c.classList.toggle('active', c.dataset.f === activeCat));
        document.querySelectorAll('[data-t]').forEach(c => c.classList.toggle('active', activeTags.has(c.dataset.t)));
        const n = activeTags.size;
        const shown = cards.filter(c => c.style.display !== 'none').length;
        const badge = mBtn.querySelector('.mfilter-badge');
        badge.textContent = shown; mBtn.classList.toggle('has', n > 0 || activeCat !== 'all');   // badge = live result count (approved mockup)
        const dBadge = document.querySelector('.dfilter-badge');
        if (dBadge) { dBadge.textContent = n; dBadge.hidden = n === 0; }
        const dBtn = document.getElementById('dFilterBtn');
        if (dBtn) dBtn.classList.toggle('has', n > 0);
        const countEl = document.getElementById('tourCount');
        if (countEl) countEl.textContent = shown;            // live result count in the head
        const mc = document.querySelector('.mcount');
        if (mc) mc.textContent = shown + ' tour' + (shown === 1 ? '' : 's');   // mobile toolbar count
        const showBtn = sheet.querySelector('.fs-show');
        if (showBtn) showBtn.textContent = `Show ${shown} tour${shown === 1 ? '' : 's'}`;
      }
      const playIn = () => riseIn(cards.filter(c => c.style.display !== 'none'));
      const refresh = () => { applyFilters(); syncUI(); playIn(); };
      function setCat(c) { activeCat = c; refresh(); if (window.innerWidth <= 680 && !sheet.classList.contains('open')) window.scrollTo({ top: grid.offsetTop - 120, behavior: 'smooth' }); }
      function toggleTag(t) { activeTags.has(t) ? activeTags.delete(t) : activeTags.add(t); refresh(); }

      // mobile sort: reorder the grid by trip length (cards[] keeps the original "Recommended" order)
      function applySort(mode) {
        const arr = [...cards];
        if (mode === 'short') arr.sort((a, b) => (+a.dataset.days) - (+b.dataset.days));
        else if (mode === 'long') arr.sort((a, b) => (+b.dataset.days) - (+a.dataset.days));
        arr.forEach(c => grid.appendChild(c));
        playIn();
      }

      // one delegated handler for every chip/row (desktop rail, mobile category swipe, and the sheet)
      document.addEventListener('click', e => {
        if (!e.target.closest('#filterBar, #filterSheet, #dCatBar, #dFilterPop, #mSortSeg')) return;
        if (e.target.closest('[data-clear]')) { activeTags.clear(); activeCat = 'all'; return refresh(); }
        const s = e.target.closest('[data-fsort]');
        if (s) { document.querySelectorAll('[data-fsort]').forEach(x => x.classList.toggle('sel', x === s)); return applySort(s.dataset.fsort); }
        const f = e.target.closest('[data-f]'); if (f) return setCat(f.dataset.f);
        const t = e.target.closest('[data-t]'); if (t) return toggleTag(t.dataset.t);
      });
      mBtn.onclick = () => { syncUI(); sheet.classList.add('open'); };
      sheet.querySelectorAll('[data-close]').forEach(el => el.onclick = () => sheet.classList.remove('open'));

      // desktop popover: toggle on button, close on outside click
      const dPop = document.getElementById('dFilterPop');
      document.getElementById('dFilterBtn').onclick = e => { e.stopPropagation(); dPop.classList.toggle('open'); };
      document.addEventListener('click', e => { if (dPop.classList.contains('open') && !e.target.closest('.dfilters-act')) dPop.classList.remove('open'); });

      // deep-link from homepage cards: ?cat=Horse riding activates that category
      const wantCat = new URLSearchParams(location.search).get('cat');
      const match = wantCat && present.find(c => c.toLowerCase() === wantCat.toLowerCase());
      if (match) setCat(match);

      refresh();
    }
  }
})();
