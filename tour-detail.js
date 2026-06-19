// Renders a single tour detail page from window.TOURS based on ?slug= or ?id=.
(function () {
  const TOURS = window.TOURS || [];
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const id = params.get('id');
  const t = TOURS.find(x => (slug && x.slug === slug) || (id && String(x.id) === id)) || TOURS[0];
  const root = document.getElementById('tourRoot');
  if (!t) { root.innerHTML = '<div class="wrap" style="padding:160px 0 80px"><h1>Tour not found</h1><p><a href="tours.html">← Back to all tours</a></p></div>'; return; }

  document.title = `${t.name} — Kyrgyzstan Tour | Alatoo`;
  const wa = `https://wa.me/996222222011?text=${encodeURIComponent("Hi Alatoo! I'm interested in the " + t.name + " tour.")}`;
  const img = i => (t.images && t.images[i]) || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80';

  const facts = [
    ['Duration', t.duration],
    ['Pace', t.tour_speed],
    ['Best season', t.season],
    ['Starts in', t.start_from],
    ['Total drive', t.total_drive && t.total_drive !== '0 km' ? t.total_drive : null]
  ].filter(f => f[1]);

  const highlights = (t.highlights && t.highlights.length ? t.highlights : t.itinerary.map(d => d.title)).slice(0, 6);

  const itineraryHTML = t.itinerary.map((d, i) => `
    <div class="tl ${i === 0 ? 'open' : ''}" data-day="${d.day}">
      <button class="tl-q" type="button">
        <div><h3>${d.title}</h3>
          <div class="meta">${[d.drive && '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 16 1.2-6.5A2 2 0 0 1 8.2 8h7.6a2 2 0 0 1 2 1.5L19 16M4 16h16v3H4Z"/><circle cx="7.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/></svg> ' + d.drive, d.overnight && '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18Z"/><path d="M12 4v16"/></svg> ' + d.overnight].filter(Boolean).join(' · ')}</div>
        </div><span class="tgl">+</span>
      </button>
      <div class="tl-a"><p>${d.desc || ''}${d.meals ? `<br/><br/><b>Meals:</b> ${d.meals}` : ''}</p></div>
    </div>`).join('');

  const galleryImgs = (t.images || []).slice(1, 9);
  const galleryHTML = galleryImgs.length ? `
    <section class="reveal in">
      <h2>Gallery</h2>
      <div class="gallery">
        ${galleryImgs.map((src, i) => `<a href="${src}" target="_blank" rel="noopener" class="${i === 0 ? 'w2 h2' : (i === 3 ? 'w2' : '')}"><img loading="lazy" src="${src}" alt="${t.name} photo ${i + 1}"></a>`).join('')}
      </div>
    </section>` : '';

  const goodToKnow = [
    ['Accommodation', t.accommodations],
    ['Activities', t.activities],
    ['Departures from', t.start_from],
    ['Best time to go', t.season]
  ].filter(f => f[1]);

  const R = window.REVIEWS || [];
  const tourRevs = R.filter(r => r.placement === 'tour:' + t.slug);
  const showRevs = (tourRevs.length ? tourRevs : R.filter(r => r.placement === 'home')).slice(0, 2);
  const rstars = n => '★★★★★'.slice(0, Math.max(1, Math.min(5, n || 5)));
  const reviewsHTML = showRevs.length ? `
        <section class="reveal in">
          <h2>What travellers say</h2>
          <div style="display:grid;gap:18px">
            ${showRevs.map(r => `<div class="review" style="max-width:none;flex:none"><div class="stars">${rstars(r.rating)}</div><p>"${r.text}"</p><div class="who"><img loading="lazy" src="${r.avatar}" alt="${r.name}"><div><b>${r.name}</b><span>${[r.country, r.context].filter(Boolean).join(' · ')}</span></div></div></div>`).join('')}
          </div>
        </section>` : '';

  root.innerHTML = `
  <section class="tour-hero">
    <div class="bg"><img src="${img(0)}" alt="${t.name}" /></div>
    <div class="wrap">
      <p class="crumb reveal in"><a href="index.html">Home</a> / <a href="tours.html">Tours</a> / ${t.name}</p>
      <div class="badges reveal in">${t.cats.map(c => `<span class="pill">${c}</span>`).join('')}<span class="pill sale">Free quote · no prepayment</span></div>
      <h1 class="reveal in">${t.name}</h1>
      <p class="sub reveal in">${t.summary || ''}</p>
      <div class="factbar reveal in">${facts.map(f => `<div class="f"><b>${f[1]}</b><span>${f[0]}</span></div>`).join('')}</div>
    </div>
  </section>

  <section class="pad">
    <div class="wrap tour-layout">
      <div class="tour-main">

        <section class="reveal in">
          <h2>Why you'll love this tour</h2>
          <div class="hl-grid">
            ${highlights.map(h => `<div class="hl"><span class="ic"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.7 5.3L19 11l-5.3 1.7L12 18l-1.7-5.3L5 11l5.3-1.7Z"/></svg></span><div><b>${h}</b></div></div>`).join('')}
          </div>
        </section>

        <section class="reveal in">
          <h2>Day-by-day itinerary</h2>
          <p>Tap any day to expand. Every itinerary can be tailored to your dates, pace and fitness.</p>
          <div class="timeline">${itineraryHTML}</div>
        </section>

        ${galleryHTML}

        <section class="reveal in">
          <h2>Good to know</h2>
          <div class="incl-grid">
            <ul class="yes">${goodToKnow.map(f => `<li><b>${f[0]}:</b>&nbsp;${f[1]}</li>`).join('')}</ul>
            <ul class="yes">
              <li>Local certified English-speaking guide</li>
              <li>Private transport & airport transfers</li>
              <li>Small group or fully private</li>
              <li>24/7 support team in Bishkek</li>
            </ul>
          </div>
        </section>

        ${reviewsHTML}

        <section id="book" class="reveal in" style="border-bottom:0">
          <h2>Request this tour</h2>
          <p>Tell us your dates and we'll confirm availability and a tailored price within 24 hours. Free to enquire, no prepayment.</p>
          <div class="form-card" style="max-width:560px;box-shadow:var(--shadow);padding:30px">
            <form id="leadForm">
              <input type="checkbox" name="botcheck" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true" />
              <input type="hidden" name="tour" value="${t.name}" />
              <div class="field"><label for="name">Full name</label><input id="name" name="name" type="text" placeholder="Jane Traveller" required /></div>
              <div class="field-row">
                <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" placeholder="you@email.com" required /></div>
                <div class="field"><label for="people">Travellers</label><select id="people" name="people"><option>1</option><option>2</option><option>3–4</option><option>5–8</option><option>9+</option></select></div>
              </div>
              <div class="field"><label for="dates">Preferred dates</label><input id="dates" name="dates" type="text" placeholder="e.g. mid-July 2026" /></div>
              <div class="field"><label for="msg">Anything else?</label><textarea id="msg" name="msg" placeholder="Fitness level, add-ons, questions…"></textarea></div>
              <button type="submit" class="btn btn-primary">Send my request →</button>
              <p class="form-note"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> We reply within 24h. No prepayment, no spam.</p>
            </form>
            <div class="form-success" id="formSuccess">
              <div class="big"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m2 20 6.5-12L13 17l3-5 6 8Z"/><path d="m8.5 8 2.2 4"/></svg></div><h3>Request received!</h3>
              <p style="color:var(--ink-soft)">A local expert will email you within 24 hours about “${t.name}”.</p>
            </div>
          </div>
        </section>
      </div>

      <aside>
        <div class="booking reveal in">
          <div class="from">Price</div>
          <div class="amount" style="font-size:1.9rem">On request</div>
          <div class="per">Tailored to group size, season & options</div>
          <div class="rateline"><span class="star">★★★★★</span> <b>4.9</b> · local guides</div>
          ${facts.map(f => `<div class="row"><span>${f[0]}</span><b>${f[1]}</b></div>`).join('')}
          <a href="#book" class="btn btn-primary" style="margin-top:18px">Request this tour →</a>
          <a href="${wa}" target="_blank" rel="noopener" class="wa-line">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.4Z"/></svg>
            Ask on WhatsApp
          </a>
          <p class="assurance"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg> Free to enquire · no prepayment<br/><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg> Tailor-made · flexible dates</p>
        </div>
      </aside>
    </div>
  </section>`;

  // update floating WA + mobile bar with tour-specific message
  document.querySelectorAll('[data-wa]').forEach(a => a.href = wa);

  // itinerary accordion
  root.querySelectorAll('.tl-q').forEach(q => {
    q.onclick = () => {
      const item = q.parentElement, a = item.querySelector('.tl-a'), open = item.classList.contains('open');
      item.classList.toggle('open');
      a.style.maxHeight = open ? null : a.scrollHeight + 'px';
    };
  });
  const first = root.querySelector('.tl.open .tl-a');
  if (first) first.style.maxHeight = first.scrollHeight + 'px';
})();
