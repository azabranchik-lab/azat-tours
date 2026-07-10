// Renders the guides grid (#guidesGrid) from window.GUIDES.
// (Per-guide testimonials removed until real reviews exist.)
(function () {
  const G = window.GUIDES || [];
  const grid = document.getElementById('guidesGrid');
  if (!grid) return;
  // honesty rule: no guides yet -> no section (same pattern as reviews);
  // it comes back by itself once real guides are added via the bot
  if (!G.length) { const sec = grid.closest('section'); if (sec) sec.style.display = 'none'; return; }
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  grid.innerHTML = G.map(g => {
    const langs = (g.languages || []).join(' · ');
    return `<div class="member reveal in">
        <div class="ph"><img loading="lazy" src="${g.photo}" alt="${esc(g.name)}">${langs ? `<span class="lang">${esc(langs)}</span>` : ''}</div>
        <h3>${esc(g.name)}</h3><div class="role">${esc(g.role)}</div><p>${esc(g.bio)}</p>
      </div>`;
  }).join('');
})();
