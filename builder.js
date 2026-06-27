// Azat Tours Trip Builder, 5-step, visual, data-aware.
(function () {
  const TOURS = window.TOURS || [];
  const WEB3FORMS_KEY = "b8d4fb62-00dc-4e7f-ab17-3f8c8b5aeced";
  const LS = 'alatoo_builder';

  const blank = { style: '', duration: '', month: '', adults: 2, children: 0, interests: [], pace: '', comfort: '', base: '', name: '', email: '', whatsapp: '' };
  let S = blank;
  try { const saved = JSON.parse(localStorage.getItem(LS)); if (saved) S = Object.assign({}, blank, saved); } catch (e) {}
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };

  let step = 0;
  const STEPS = ['Style', 'When & who', 'Experiences', 'Pace & comfort', 'Review & send'];

  // ---- option data ----
  const STYLES = [
    { id: 'Horse riding', t: 'Horseback riding', d: 'Ride like a nomad to alpine lakes', img: '1486870591958-9b9d0d1dda99' },
    { id: 'Combined', t: 'A bit of everything', d: 'Ride, trek & road-trip combined', img: '1464822759023-fed622ff2c3b' },
    { id: 'Road trip', t: 'Road trip & comfort', d: 'Scenic drives, less effort', img: '1519681393784-d120267933ba' },
    { id: 'Off-the-beaten-path', t: 'Off the beaten path', d: 'Remote valleys, real nomad life', img: '1533105079780-92b9be482077' },
    { id: 'Winter tours', t: 'Winter adventure', d: 'Snowy passes & frozen lakes', img: '1551632811-561732d1e306' },
    { id: 'notsure', t: 'Not sure yet', d: 'Help me choose, surprise me!', img: '1506905925346-21bda4d32df4' }
  ];
  const DURATIONS = [['3-4', '3-4 days'], ['5-7', '5-7 days'], ['8-10', '8-10 days'], ['11+', '11+ days'], ['flexible', 'Flexible']];
  const MONTHS = ['Flexible', 'May', 'June', 'July', 'August', 'September', 'October', 'Winter'];
  const INTERESTS = [
    { t: 'Song-Köl yurt stay', img: '1533105079780-92b9be482077' },
    { t: 'Horseback riding', img: '1486870591958-9b9d0d1dda99' },
    { t: 'Ala-Köl trek', img: '1551632811-561732d1e306' },
    { t: 'Issyk-Köl lake', img: '1464822759023-fed622ff2c3b' },
    { t: 'Kel-Suu lake & off-road', img: '1454496522488-7a8e488e8606' },
    { t: 'Tash-Rabat & Silk Road', img: '1519681393784-d120267933ba' },
    { t: 'Eagle hunters & Kok-Boru', img: '1488646953014-85cb44e25828' },
    { t: 'Hot springs', img: '1469474968028-56623f02e42e' },
    { t: 'Nomad family life', img: '1506905925346-21bda4d32df4' }
  ];
  const PACE = [
    { id: 'Relaxed', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c8 1 14-5 14-14C10 5 4 11 5 19Z"/><path d="M5 19c3-5 6-8 11-10"/></svg>', t: 'Relaxed', d: 'A couple of places, longer stays' },
    { id: 'Moderate', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="5" r="1.6"/><path d="m12 9-3 4 3 1.5 1 6.5M12 9l4 1.5M9 13l-2 6.5"/></svg>', t: 'Moderate', d: 'A balanced mix of stays & stops' },
    { id: 'Fast', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3 5 14h6l-1 7 8-11h-6Z"/></svg>', t: 'Fast-paced', d: 'See as much as possible' }
  ];
  const COMFORT = [
    { id: 'Authentic', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18Z"/><path d="M12 4v16"/></svg>', t: 'Authentic', d: 'Yurts & family homestays, basic comfort' },
    { id: 'Mixed', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18Z"/><path d="M12 4v16"/></svg>', t: 'Mixed', d: 'Blend of comfort & local stays' },
    { id: 'Comfortable', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20v-3h4v3"/></svg>', t: 'Comfortable', d: 'Hotels & modern amenities where possible' }
  ];
  const img = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w || 600}&q=70`;

  // ---- matching: filter tours by style + duration ----
  function matchTours() {
    const inRange = d => {
      if (S.duration === '3-4') return d <= 4; if (S.duration === '5-7') return d >= 5 && d <= 7;
      if (S.duration === '8-10') return d >= 8 && d <= 10; if (S.duration === '11+') return d >= 11; return true;
    };
    const scored = TOURS.map(t => {
      let s = 0;
      if (S.style && S.style !== 'notsure' && t.cats.includes(S.style)) s += 2;
      if (S.style === 'Combined' && /trekking|horse/i.test(t.activities)) s += 1;
      if (inRange(t.days)) s += 2;
      // interest keyword bonus
      S.interests.forEach(i => { const key = i.split(/[\s-]/)[0]; if (new RegExp(key, 'i').test(t.name + t.summary)) s += 1; });
      return { t, s };
    }).sort((a, b) => b.s - a.s);
    return scored.filter(x => x.s > 0).slice(0, 3).map(x => x.t);
  }

  // ---- render ----
  const el = id => document.getElementById(id);
  function render() { renderBar(); renderStep(); renderSummary(); save(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function renderBar() {
    el('stepsBar').innerHTML = STEPS.map((_, i) => `<div class="sstep ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}"></div>`).join('');
  }

  function header(label, h, sub) {
    return `<div class="step-label">Step ${step + 1} of ${STEPS.length} · ${label}</div><h1 class="step-h">${h}</h1><p class="step-sub">${sub}</p>`;
  }
  function navBtns(canSkip) {
    return `<div class="builder-nav">
      <button class="btn btn-ghost" style="border-color:var(--line);color:var(--ink)" ${step === 0 ? 'disabled style="opacity:.4;border-color:var(--line);color:var(--ink)"' : ''} onclick="BUILDER.back()">← Back</button>
      ${canSkip ? '<button class="skip" onclick="BUILDER.next()">Skip this step</button>' : ''}
      <button class="btn btn-primary" onclick="BUILDER.next()">${step === STEPS.length - 1 ? 'Done' : 'Continue'}</button>
    </div>`;
  }

  function renderStep() {
    const a = el('stepArea');
    if (step === 0) {
      a.innerHTML = header('Trip style', "What kind of adventure?", "Pick the vibe that excites you most. Not sure? Choose “Not sure yet” and we'll suggest.") +
        `<div class="opt-cards">${STYLES.map(s => `
          <button class="opt-card ${S.style === s.id ? 'sel' : ''}" onclick="BUILDER.set('style','${s.id}')">
            <span class="tick"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg></span>
            <span class="im"><img loading="lazy" src="${img(s.img)}" alt="${s.t}"></span>
            <span class="tx"><b>${s.t}</b><span>${s.d}</span></span>
          </button>`).join('')}</div>` + navBtns(false);
    }
    else if (step === 1) {
      a.innerHTML = header('When & who', "How long, when, and how many?", "Rough answers are fine, everything is flexible and tailor-made.") +
        `<div class="field-group"><label>Trip length</label><div class="b-chips">${DURATIONS.map(d => `<button class="b-chip ${S.duration === d[0] ? 'sel' : ''}" onclick="BUILDER.set('duration','${d[0]}')">${d[1]}</button>`).join('')}</div></div>
         <div class="field-group"><label>When do you want to travel?</label><div class="b-chips">${MONTHS.map(m => `<button class="b-chip ${S.month === m ? 'sel' : ''}" onclick="BUILDER.set('month','${m}')">${m}</button>`).join('')}</div></div>
         <div class="field-group"><label>Who's coming?</label><div class="steppers">
           <div class="stepper"><div class="lab"><b>Adults</b><span>13+ years</span></div><div class="ctrl"><button onclick="BUILDER.bump('adults',-1)">−</button><span class="val" id="vAdults">${S.adults}</span><button onclick="BUILDER.bump('adults',1)">+</button></div></div>
           <div class="stepper"><div class="lab"><b>Children</b><span>0-12 years</span></div><div class="ctrl"><button onclick="BUILDER.bump('children',-1)">−</button><span class="val" id="vChildren">${S.children}</span><button onclick="BUILDER.bump('children',1)">+</button></div></div>
         </div></div>` + navBtns(false);
    }
    else if (step === 2) {
      a.innerHTML = header('Experiences', "What do you want to experience?", "Tap everything that appeals, or skip it and leave it to us. Multiple choices welcome.") +
        `<div class="interest-grid">${INTERESTS.map(i => `
          <button class="int-card ${S.interests.includes(i.t) ? 'sel' : ''}" onclick="BUILDER.toggleInterest('${i.t.replace(/'/g, "\\'")}')">
            <span class="tick"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg></span><img loading="lazy" src="${img(i.img, 500)}" alt="${i.t}"><span class="cap">${i.t}</span>
          </button>`).join('')}</div>` + navBtns(true);
    }
    else if (step === 3) {
      a.innerHTML = header('Pace & comfort', "Your travel style", "Two quick questions about how you like to travel.") +
        `<div class="field-group"><label>Preferred pace</label><div class="choice-cards">${PACE.map(p => `<button class="choice ${S.pace === p.id ? 'sel' : ''}" onclick="BUILDER.set('pace','${p.id}')"><span class="ic">${p.ic}</span><b>${p.t}</b><span>${p.d}</span></button>`).join('')}</div></div>
         <div class="field-group"><label>Accommodation comfort</label><div class="choice-cards">${COMFORT.map(c => `<button class="choice ${S.comfort === c.id ? 'sel' : ''}" onclick="BUILDER.set('comfort','${c.id}')"><span class="ic">${c.ic}</span><b>${c.t}</b><span>${c.d}</span></button>`).join('')}</div></div>` + navBtns(true);
    }
    else if (step === 4) {
      const matches = matchTours();
      const matchHTML = matches.length ? `
        <div class="field-group"><label>Tours that match your choices, pick one as a starting point (optional)</label>
        <div class="match-list">
          ${matches.map(t => `<div class="match ${S.base === t.slug ? 'sel' : ''}" onclick="BUILDER.set('base','${t.slug}')">
            <img loading="lazy" src="${t.images && t.images[0] ? t.images[0] : img('1506905925346-21bda4d32df4')}" alt="${t.name}">
            <div class="mb"><b>${t.name}</b><span>${t.duration} · ${t.cats.join(', ')}</span></div><span class="tick"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg></span></div>`).join('')}
          <div class="match ${S.base === 'custom' ? 'sel' : ''}" onclick="BUILDER.set('base','custom')">
            <div style="width:96px;height:72px;border-radius:10px;background:var(--paper-2);display:grid;place-items:center;flex:none;font-size:1.6rem"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.7 5.3L19 11l-5.3 1.7L12 18l-1.7-5.3L5 11l5.3-1.7Z"/></svg></div>
            <div class="mb"><b>Build it fully custom</b><span>Start from a blank canvas around my choices</span></div><span class="tick"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg></span></div>
        </div></div>` : '';
      a.innerHTML = header('Review & send', "Your trip, ready to plan", "Check the summary, add your details, and a local expert sends a tailored plan within 24 hours. Free, no prepayment.") +
        matchHTML +
        `<div class="form-card" style="box-shadow:var(--shadow);max-width:none">
          <form id="bForm">
            <input type="checkbox" name="botcheck" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true" />
            <div class="field-row">
              <div class="field"><label for="bname">First & last name</label><input id="bname" type="text" placeholder="Jane Traveller" required value="${S.name}"></div>
              <div class="field"><label for="bemail">Email</label><input id="bemail" type="email" placeholder="you@email.com" required value="${S.email}"></div>
            </div>
            <div class="field"><label for="bwa">WhatsApp number (optional)</label><input id="bwa" type="tel" placeholder="+1 555 123 4567" value="${S.whatsapp}"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:6px">Send my trip request</button>
            <p class="form-note"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> We reply within 24h. No prepayment, no spam.</p>
          </form>
          <div style="text-align:center;margin-top:14px">
            <a href="#" id="waSend" target="_blank" rel="noopener" class="msg-btn wa" style="color:#128C42;border-color:#25D366;justify-content:center;display:inline-flex">Or send it via WhatsApp instead</a>
          </div>
          <div class="form-success" id="bSuccess">
            <div class="big"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m2 20 6.5-12L13 17l3-5 6 8Z"/><path d="m8.5 8 2.2 4"/></svg></div><h3>Trip request sent!</h3>
            <p style="color:var(--ink-soft)">A local expert will email you within 24 hours with a tailored plan${S.name ? ', ' + S.name.split(' ')[0] : ''}.</p>
          </div>
        </div>` +
        `<div class="builder-nav"><button class="btn btn-ghost" style="border-color:var(--line);color:var(--ink)" onclick="BUILDER.back()">← Back</button><span></span></div>`;
      wireForm();
    }
  }

  function summaryText() {
    const lines = [];
    lines.push(', AZAT TOURS TRIP REQUEST, ');
    if (S.style) lines.push('Style: ' + (S.style === 'notsure' ? 'Not sure / suggest' : S.style));
    if (S.duration) lines.push('Length: ' + (DURATIONS.find(d => d[0] === S.duration) || [, S.duration])[1]);
    if (S.month) lines.push('When: ' + S.month);
    lines.push('Travellers: ' + S.adults + ' adult(s)' + (S.children ? ', ' + S.children + ' child(ren)' : ''));
    if (S.interests.length) lines.push('Interests: ' + S.interests.join(', '));
    if (S.pace) lines.push('Pace: ' + S.pace);
    if (S.comfort) lines.push('Comfort: ' + S.comfort);
    if (S.base && S.base !== 'custom') { const t = TOURS.find(x => x.slug === S.base); if (t) lines.push('Based on: ' + t.name); }
    if (S.base === 'custom') lines.push('Based on: fully custom');
    return lines.join('\n');
  }

  function renderSummary() {
    const row = (k, v) => `<div class="sum-row"><span class="k">${k}</span><span class="v ${v ? '' : 'empty'}">${v || 'Any'}</span></div>`;
    const dur = S.duration ? (DURATIONS.find(d => d[0] === S.duration) || [, S.duration])[1] : '';
    const base = S.base === 'custom' ? 'Fully custom' : (S.base ? (TOURS.find(x => x.slug === S.base) || {}).name : '');
    el('summary').innerHTML = `
      <h3>Your trip so far</h3>
      <p class="muted">Builds as you choose, nothing is final.</p>
      ${row('Style', S.style === 'notsure' ? 'Suggest for me' : S.style)}
      ${row('Length', dur)}
      ${row('When', S.month)}
      ${row('Travellers', S.adults + (S.children ? '+' + S.children + ' kids' : ' adults'))}
      ${row('Interests', S.interests.length ? S.interests.length + ' selected' : '')}
      ${row('Pace', S.pace)}
      ${row('Comfort', S.comfort)}
      ${base ? row('Base tour', base) : ''}
      ${step < 4 ? `<button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:18px" onclick="BUILDER.jumpToEnd()">Skip to request</button>` : ''}`;
  }

  function wireForm() {
    const f = el('bForm'); if (!f) return;
    const sync = () => { S.name = el('bname').value; S.email = el('bemail').value; S.whatsapp = el('bwa').value; save(); updateWa(); };
    ['bname', 'bemail', 'bwa'].forEach(id => el(id).addEventListener('input', sync));
    updateWa();
    f.addEventListener('submit', async e => {
      e.preventDefault(); sync();
      const btn = f.querySelector('button[type="submit"]'); const orig = btn.textContent;
      if (!WEB3FORMS_KEY || WEB3FORMS_KEY.startsWith('YOUR-')) { f.style.display = 'none'; el('bSuccess').classList.add('show'); localStorage.removeItem(LS); return; }
      btn.disabled = true; btn.textContent = 'Sending…';
      const payload = { name: S.name, email: S.email, whatsapp: S.whatsapp, tour: 'Trip Builder request', trip_summary: summaryText() };
      try {
        const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await r.json();
        if (j.ok) { f.style.display = 'none'; el('bSuccess').classList.add('show'); localStorage.removeItem(LS); }
        else throw new Error();
      } catch (err) { btn.disabled = false; btn.textContent = orig; alert('Something went wrong. Please send via WhatsApp instead.'); }
    });
  }
  function updateWa() {
    const wa = el('waSend'); if (!wa) return;
    const txt = summaryText() + (S.name ? '\n\nName: ' + S.name : '') + (S.email ? '\nEmail: ' + S.email : '');
    wa.href = 'https://wa.me/996222222011?text=' + encodeURIComponent(txt);
  }

  // ---- public API ----
  window.BUILDER = {
    set(k, v) { S[k] = (S[k] === v && k !== 'base') ? '' : v; render(); },
    toggleInterest(t) { const i = S.interests.indexOf(t); if (i >= 0) S.interests.splice(i, 1); else S.interests.push(t); render(); },
    bump(k, d) { S[k] = Math.max(k === 'adults' ? 1 : 0, Math.min(20, S[k] + d)); render(); },
    next() { if (step < STEPS.length - 1) { step++; render(); } },
    back() { if (step > 0) { step--; render(); } },
    jumpToEnd() { step = STEPS.length - 1; render(); }
  };

  render();
})();
