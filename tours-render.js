// Renders tour cards from window.TOURS (loaded via tours-data.js).
// Used on tours.html (full catalog + filters) and index.html (featured grid).
(function () {
  const TOURS = window.TOURS || [];
  const waMsg = name => `https://wa.me/996222222011?text=${encodeURIComponent("Hi Azat Tours! I'm interested in the " + name + " tour.")}`;

  const ARROW = '<svg class="cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  function card(t) {
    const img = t.images && t.images[0] ? t.images[0] : 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80';
    const hl = (t.highlights && t.highlights.length ? t.highlights : t.itinerary.map(d => d.title))
      .slice(0, 3).map(h => `<li>${h}</li>`).join('');
    const link = `tour.html?slug=${encodeURIComponent(t.slug)}`;
    return `
      <a class="tour" href="${link}" data-cats="${t.cats.join('|')}">
        <div class="tour-img">
          <img loading="lazy" src="${img}" alt="${t.name}" />
          <span class="tour-badge">${t.cats[0] || t.category}</span>
          ${t.duration ? `<span class="tour-dur">${t.duration}</span>` : ''}
        </div>
        <div class="tour-body">
          <h3>${t.name}</h3>
          <ul>${hl}</ul>
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
  }

  // ---- CATALOG (tours.html) ----
  const grid = document.getElementById('toursGrid');
  if (grid) {
    grid.innerHTML = TOURS.map(card).join('');
    document.getElementById('tourCount') && (document.getElementById('tourCount').textContent = TOURS.length);

    // build filter chips from categories actually present, in a sensible order
    const order = ['Combined', 'Horse riding', 'Road trip', 'Off-the-beaten-path', 'Winter tours'];
    const present = order.filter(c => TOURS.some(t => t.cats.includes(c)));
    const bar = document.getElementById('filterBar');
    if (bar) {
      bar.innerHTML =
        `<button class="chip active" data-f="all">All tours <span style="opacity:.6">${TOURS.length}</span></button>` +
        present.map(c => {
          const n = TOURS.filter(t => t.cats.includes(c)).length;
          return `<button class="chip" data-f="${c}">${c} <span style="opacity:.6">${n}</span></button>`;
        }).join('');

      const cards = [...grid.querySelectorAll('.tour')];
      const noRes = document.querySelector('.no-result');
      bar.querySelectorAll('.chip').forEach(chip => {
        chip.onclick = () => {
          bar.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const f = chip.dataset.f;
          let shown = 0;
          cards.forEach(c => {
            const match = f === 'all' || c.dataset.cats.split('|').includes(f);
            c.style.display = match ? '' : 'none';
            if (match) shown++;
          });
          if (noRes) noRes.classList.toggle('show', shown === 0);
          window.scrollTo({ top: grid.offsetTop - 120, behavior: 'smooth' });
        };
      });
    }
  }
})();
