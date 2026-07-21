// Renders tour cards from window.TOURS (loaded via tours-data.js).
// Used on tours.html (full catalog + filters) and index.html (featured grid).
(function () {
  const TOURS = window.TOURS || [];
  const waMsg = name => `https://wa.me/996222222011?text=${encodeURIComponent("Hi Azat Tours! I'm interested in the " + name + " tour.")}`;
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // soft rise-in for a set of cards (stagger capped so long lists don't crawl)
  function riseIn(els) {
    if (reduceMotion) return;
    els.forEach(c => c.classList.remove('animate-in'));
    if (els[0]) void els[0].offsetWidth;                      // reflow → restart animation
    els.forEach((c, i) => { c.style.animationDelay = (Math.min(i, 8) * 35) + 'ms'; c.classList.add('animate-in'); });
  }

  const ARROW = '';
  function card(t) {
    const img = t.images && t.images[0] ? t.images[0] : 'img/hero/hero-1-reflection-1400.jpg';
    const hl = (t.highlights && t.highlights.length ? t.highlights : t.itinerary.map(d => d.title))
      .slice(0, 3).map(h => `<li>${h}</li>`).join('');
    const b = t.blurb;
    const body = (b && b.text)
      ? `${b.hook ? `<p class="tour-hook">${b.hook}</p>` : ''}<p class="tour-blurb">${b.text}</p>`
      : `<ul>${hl}</ul>`;   // fallback: tours without a blurb show highlight bullets
    const link = `tour.html?slug=${encodeURIComponent(t.slug)}`;
    // compact meta chips (shown on mobile cards only, hidden on desktop via CSS)
    const meta = '<div class="tour-meta">' +
      `<span class="tm tm-cat">${t.cats[0] || t.category}</span>` +
      (t.duration ? `<span class="tm">${t.duration}</span>` : '') +
      (t.tour_speed ? `<span class="tm">${t.tour_speed.replace(/[\s-]*paced$/i, '').replace(/^Moderately$/i, 'Moderate').trim()}</span>` : '') +
      '</div>';
    return `
      <a class="tour" href="${link}" data-cats="${t.cats.join('|')}" data-tags="${(t.tags || []).join('|')}" data-days="${t.days || 0}">
        <div class="tour-img">
          <img loading="lazy" src="${img}" alt="${t.name}" />
          <span class="tour-badge">${t.cats[0] || t.category}</span>
          ${t.duration ? `<span class="tour-dur">${t.duration}</span>` : ''}
        </div>
        <div class="tour-body">
          <h3>${t.name}</h3>
          ${meta}
          ${body}
          <div class="tour-foot">
            <span class="tour-tag">${t.tour_speed || 'Small group'}</span>
            <span class="tour-cta">View details ${ARROW}</span>
          </div>
        </div>
      </a>`;
  }

  // ---- FEATURED (index.html) ----
  const featured = document.getElementById('featuredGrid');
  if (featured) {
    // a varied pick: a few long combined trips + a horse trip + a short one
    const pick = [];
    const byDays = [...TOURS].sort((a, b) => b.days - a.days);
    const want = ['best-of-kyrgyzstan-10-days', 'song-kol-to-ala-kol-horse-riding-trekking-7-days', 'kyrgyzstan-horseback-riding-tour-7-days', 'kyrgyzstan-ultimate-road-trip-8-days', 'song-kol-lake-on-horseback-3-days', 'ysyk-kol-lake-road-trip-4-days'];
    want.forEach(s => { const t = TOURS.find(x => x.slug === s); if (t) pick.push(t); });
    while (pick.length < 6 && byDays.length) { const t = byDays.shift(); if (!pick.includes(t)) pick.push(t); }
    featured.innerHTML = pick.slice(0, 6).map(card).join('');
    riseIn([...featured.querySelectorAll('.tour')]);
  }

  // ---- CATALOG (tours.html) ----
  const grid = document.getElementById('toursGrid');
  if (grid) {
    grid.innerHTML = TOURS.map(card).join('');
    document.getElementById('tourCount') && (document.getElementById('tourCount').textContent = TOURS.length);

    const cards = [...grid.querySelectorAll('.tour')];
    const noRes = document.querySelector('.no-result');
    const bar = document.getElementById('filterBar');

    // category chips (single-select, top row)
    const order = ['Combined', 'Horse riding', 'Road trip', 'Off-the-beaten-path', 'Winter tours'];
    const present = order.filter(c => TOURS.some(t => t.cats.includes(c)));

    // tag chips (multi-select, second row), activity / duration / season, in a sensible order
    const TAG_ORDER = [
      ['trekking', 'Trekking'], ['horseback', 'Horseback'], ['road-trip', 'Road trip'], ['off-road', 'Off-road'],
      ['short', 'Up to 4 days'], ['week', '1 week'], ['long', '9+ days'],
      ['summer', 'Summer'], ['winter', 'Winter'], ['all-year', 'All year'],
    ];
    const tagCount = tag => TOURS.filter(t => (t.tags || []).includes(tag)).length;
    const presentTags = TAG_ORDER.filter(([k]) => tagCount(k) > 0);

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

    if (bar) {
      const tagLabel = k => (TAG_ORDER.find(x => x[0] === k) || [k, k])[1];

      // category chips (desktop row + mobile swipe row)
      bar.innerHTML =
        `<button class="chip active" data-f="all">All <span style="opacity:.6">${TOURS.length}</span></button>` +
        present.map(c => `<button class="chip" data-f="${c}">${c} <span style="opacity:.6">${TOURS.filter(t => t.cats.includes(c)).length}</span></button>`).join('');

      // shared "filters" icon (same on the desktop All-filters button, below)
      const FIC = '<svg class="dfb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="8" x2="20" y2="8"/><circle cx="10" cy="8" r="2.4" fill="var(--surface)"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2.4" fill="var(--surface)"/></svg>';
      // mobile "All filters" button (one big touch target; opens the sheet). Keeps a hidden
      // badge span so the .has active-state hook still works; count shown in the toolbar line.
      const mBtn = document.createElement('button');
      mBtn.id = 'mFilterBtn'; mBtn.className = 'mfilter-btn'; mBtn.type = 'button';
      mBtn.innerHTML = `${FIC}<span>All filters</span><span class="mfilter-badge" hidden>${TOURS.length}</span>`;

      // mobile bottom-sheet: Type (categories, single-select) + tag filters, grouped
      const GROUPS = [['Activity', ['trekking', 'horseback', 'road-trip', 'off-road']], ['Duration', ['short', 'week', 'long']], ['Season', ['summer', 'winter', 'all-year']]];
      const sheetCats = `<button class="chip chip-tag" type="button" data-f="all">All <span class="chip-n">${TOURS.length}</span></button>` +
        present.map(c => `<button class="chip chip-tag" type="button" data-f="${c}">${c} <span class="chip-n">${TOURS.filter(t => t.cats.includes(c)).length}</span></button>`).join('');
      const sheet = document.createElement('div');
      sheet.id = 'filterSheet'; sheet.className = 'filter-sheet';
      // Sort now lives in a visible segment in the mobile toolbar (below), not in the sheet.
      sheet.innerHTML =
        '<div class="fs-backdrop" data-close></div>' +
        '<div class="fs-panel">' +
          '<div class="fs-head"><b>All filters</b><button class="fs-x" type="button" data-close aria-label="Close">&times;</button></div>' +
          '<div class="fs-body">' +
          `<div class="fs-group"><div class="fs-gtitle">Type</div><div class="fs-chips">${sheetCats}</div></div>` +
          GROUPS.map(([g, keys]) => {
            const ks = keys.filter(k => tagCount(k) > 0);
            return ks.length ? `<div class="fs-group"><div class="fs-gtitle">${g}</div><div class="fs-chips">` +
              ks.map(k => `<button class="chip chip-tag" type="button" data-t="${k}">${tagLabel(k)} <span class="chip-n">${tagCount(k)}</span></button>`).join('') + '</div></div>' : '';
          }).join('') +
          '</div>' +
          '<div class="fs-foot"><button class="fs-clear" type="button" data-clear>Clear</button><button class="fs-show btn btn-primary" type="button" data-close>Show tours</button></div>' +
        '</div>';
      document.body.appendChild(sheet);

      // ---- desktop toolbar: Filters button (left, opens a popover) + category pills ----
      // Own markup; reuses only the shared data-f/data-t engine, so syncUI keeps it in sync.
      const catBtns = `<button class="chip active" data-f="all">All <span class="chip-n">${TOURS.length}</span></button>` +
        present.map(c => `<button class="chip" data-f="${c}">${c} <span class="chip-n">${TOURS.filter(t => t.cats.includes(c)).length}</span></button>`).join('');
      const popGroups = GROUPS.map(([g, keys]) => {
        const ks = keys.filter(k => tagCount(k) > 0);
        return ks.length ? `<div class="dpop-group"><div class="dpop-gtitle">${g}</div><div class="dpop-chips">` +
          ks.map(k => `<button class="chip chip-tag" type="button" data-t="${k}">${tagLabel(k)} <span class="chip-n">${tagCount(k)}</span></button>`).join('') + '</div></div>' : '';
      }).join('');
      const dfilters = document.createElement('div');
      dfilters.className = 'dfilters';
      dfilters.innerHTML =
        '<div class="dfilters-act">' +
          `<button class="dfilter-btn" id="dFilterBtn" type="button">${FIC}<span>All filters</span><span class="dfilter-badge" hidden>0</span></button>` +
          '<div class="dpop" id="dFilterPop">' +
            '<div class="dpop-head"><b>All filters</b><button class="dpop-clear" type="button" data-clear>Clear all</button></div>' +
            `<div class="dpop-body">${popGroups}</div>` +
          '</div>' +
        '</div>' +
        `<div class="dcats" id="dCatBar">${catBtns}</div>`;
      const main = grid.closest('.catalog-main');
      main.insertBefore(dfilters, bar);   // above the mobile #filterBar, i.e. above the grid

      // ---- mobile toolbar: one big "Filters & sort" button + live count (sort moved into the sheet) ----
      const mtb = document.createElement('div');
      mtb.className = 'mtoolbar';
      const mCount = document.createElement('span');
      mCount.className = 'mcount'; mCount.textContent = TOURS.length + ' tours';
      // visible sort segment (Recommended / Shortest / Longest) — same data-fsort engine as before
      const mSort = document.createElement('div');
      mSort.className = 'msort-seg'; mSort.id = 'mSortSeg';
      mSort.innerHTML = [['rec', 'Recommended'], ['short', 'Shortest'], ['long', 'Longest']]
        .map(([k, l]) => `<button type="button" data-fsort="${k}"${k === 'rec' ? ' class="sel"' : ''}>${l}</button>`).join('');
      mtb.append(mCount, mSort, mBtn);
      main.insertBefore(mtb, grid);

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
