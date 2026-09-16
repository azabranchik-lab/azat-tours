// Azat Tours Trip Builder, 5-step, visual, data-aware.
(function () {
  const TOURS = window.TOURS || [];
  const LS = 'alatoo_builder';

  const blank = { style: '', nights: 7, whenMode: 'months', months: [], anyMonth: false, dateFrom: '', dateTo: '', adults: 2, children: 0, effort: '', riding: '', comfort: '', base: '', name: '', email: '', whatsapp: '' };
  let S = Object.assign({}, blank);
  try {
    const saved = JSON.parse(localStorage.getItem(LS));
    if (saved) S = Object.assign({}, blank, saved);
  } catch (e) {}
  // returning visitors carry the old shape (month as a string, duration as a band id); drop it
  // rather than let a string land where the render now expects an array
  if (!Array.isArray(S.months)) S.months = [];
  if (typeof S.nights !== 'number' || !isFinite(S.nights)) S.nights = 7;
  delete S.month; delete S.duration;
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };

  let step = 0;
  // The old "Experiences" step asked the same thing as step 1 in different words (its "Horseback
// riding" card was a verbatim copy of the style card) and fed the matcher almost nothing: three of
  // its nine options scored 0 tours because the catalogue spells the lakes differently. It is gone.
  // What replaced it is the question that actually changes the quote: can this traveller do the route.
  const STEPS = ['Style', 'When & who', 'Your style', 'Review & send'];

  // A request with no answers is useless to the owner, so the first two steps ask for one.
  // Both have a one-tap honest way out ("Not sure yet", "Flexible"), so this costs a tap, not a
  // decision. Steps 3 and 4 stay optional, they already offer "Skip this step".
  const REQUIRED = { 0: ['style'], 1: ['when'] };
  const ASK = {
    style: 'Pick one, or tap “Not sure yet” and we’ll suggest.',
    when: 'Pick a month or two, or tap “I’m flexible” and we’ll suggest the season.'
  };
  // screen state, deliberately not part of S: S is persisted, this is not an answer
  let invalid = [];
  // nights always carry a value, so "when" is the only real gate: a month, the flexible row,
  // or a pair of exact dates all count as an answer
  const answered = k => k === 'when'
    ? (S.anyMonth || S.months.length > 0 || (S.whenMode === 'exact' && S.dateFrom && S.dateTo))
    : !!S[k];
  const missing = s => (REQUIRED[s] || []).filter(k => !answered(k));
  const flag = k => invalid.includes(k) ? ' needs-pick' : '';
  const askLine = k => invalid.includes(k) ? `<p class="form-err" role="alert">${ASK[k]}</p>` : '';

  // ---- option data ----
  const STYLES = [
    { id: 'Horse riding', t: 'Horseback riding', d: 'Ride like a nomad to alpine lakes', img: '1486870591958-9b9d0d1dda99' },
    { id: 'Combined', t: 'A bit of everything', d: 'Ride, trek & road-trip combined', img: '1464822759023-fed622ff2c3b' },
    { id: 'Road trip', t: 'Road trip & comfort', d: 'Scenic drives, less effort', img: '1454496522488-7a8e488e8606' },
    { id: 'Off-the-beaten-path', t: 'Off the beaten path', d: 'Remote valleys, real nomad life', img: '1519681393784-d120267933ba' },
    { id: 'Winter tours', t: 'Winter adventure', d: 'Snowy passes & frozen lakes', img: '1551632811-561732d1e306' },
    { id: 'notsure', t: 'Not sure yet', d: 'Help me choose, surprise me!', img: '1506905925346-21bda4d32df4' }
  ];
  // 12 months forward, always labelled with the year: "July" alone is ambiguous in December.
  // Built from today, so the list never offers a month that has already passed.
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS = (() => {
    const out = [], now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push({ id: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), short: MONTH_NAMES[d.getMonth()].slice(0, 3), long: MONTH_NAMES[d.getMonth()], year: d.getFullYear() });
    }
    return out;
  })();
  const monthLabel = id => { const m = MONTHS.find(x => x.id === id); return m ? m.long + ' ' + m.year : id; };
  // "August or September 2026" reads like a person wrote it; the year is stated once when shared
  const whenText = () => {
    if (S.whenMode === 'exact' && S.dateFrom && S.dateTo) return fmtRange(S.dateFrom, S.dateTo);
    if (S.anyMonth) return 'Flexible, suggest the best season';
    if (!S.months.length) return '';
    const picked = MONTHS.filter(m => S.months.includes(m.id));
    const years = [...new Set(picked.map(m => m.year))];
    if (years.length === 1) return picked.map(m => m.long).join(' or ') + ' ' + years[0];
    return picked.map(m => m.long + ' ' + m.year).join(' or ');
  };
  const fmtRange = (a, b) => {
    const d1 = new Date(a), d2 = new Date(b);
    if (isNaN(d1) || isNaN(d2)) return '';
    const same = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
    const f = (d, withMonth) => d.getDate() + (withMonth ? ' ' + MONTH_NAMES[d.getMonth()].slice(0, 3) : '') + (withMonth ? ' ' + d.getFullYear() : '');
    return same ? d1.getDate() + '-' + f(d2, true) : f(d1, true) + ' to ' + f(d2, true);
  };
  const nightsBetween = (a, b) => {
    const d1 = new Date(a), d2 = new Date(b);
    if (isNaN(d1) || isNaN(d2)) return 0;
    return Math.max(0, Math.round((d2 - d1) / 86400000));
  };
  // Replaces the old "Pace". "Moderate" told the owner nothing and never reached the matcher;
  // hours in the saddle or on foot is the number he actually needs to quote a route.
  const EFFORT = [
    { id: '2-3h', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c8 1 14-5 14-14C10 5 4 11 5 19Z"/><path d="M5 19c3-5 6-8 11-10"/></svg>', t: '2-3 hours a day', d: 'Easy days with plenty of stops' },
    { id: '4-5h', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="5" r="1.6"/><path d="m12 9-3 4 3 1.5 1 6.5M12 9l4 1.5M9 13l-2 6.5"/></svg>', t: '4-5 hours a day', d: 'A steady rhythm, the usual pace' },
    { id: '6h+', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3 5 14h6l-1 7 8-11h-6Z"/></svg>', t: '6+ hours a day', d: 'Give me the demanding version' },
    { id: 'guide', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.2-1.2.9-1.2 1.6v.3"/><path d="M12 17h.01"/></svg>', t: 'Let the guide decide', d: 'Match it to the group' }
  ];
  // Only asked when the trip can involve horses. A beginner and a confident rider are two different
  // quotes, and today both arrive looking identical.
  const RIDING = [
    { id: 'never', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>', t: 'Never sat on a horse', d: 'We start with the basics' },
    { id: 'few', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 13.5 11 16l5-6"/></svg>', t: 'Ridden a few times', d: 'Comfortable at a walk' },
    { id: 'confident', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.4 5.4 5.6.6-4.2 3.9 1.2 5.6L12 15.7 7 18.5l1.2-5.6L4 9l5.6-.6Z"/></svg>', t: 'Confident rider', d: 'Long days in the saddle are fine' },
    { id: 'norides', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.8 8.8 6.4 6.4M15.2 8.8l-6.4 6.4"/></svg>', t: 'I would rather not ride', d: 'Keep the horses optional' }
  ];
  // riding only makes sense for styles that can put you on a horse
  const ridingAsked = () => ['Horse riding', 'Combined', 'notsure', ''].includes(S.style);
  const COMFORT = [
    { id: 'Authentic', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18Z"/><path d="M12 4v16"/></svg>', t: 'Authentic', d: 'Yurts & family homestays, basic comfort' },
    { id: 'Mixed', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18Z"/><path d="M12 4v16"/></svg>', t: 'Mixed', d: 'Blend of comfort & local stays' },
    { id: 'Comfortable', ic: '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20v-3h4v3"/></svg>', t: 'Comfortable', d: 'Hotels & modern amenities where possible' }
  ];
  // ---- real photos, taken from the tours and the sights the owner already manages ----
  // Nothing is hardcoded here on purpose: replace a tour photo with /tours or a place photo with
  // /sights in the bot and this screen follows, because both read the same generated data.
  const SIGHTS = window.SIGHTS || {};
  const unsplash = () => 'img/hero/hero-1-reflection-1400.jpg'; // local fallback (was Unsplash placeholder)

  const tourPhoto = (pick, taken) => {
    const t = TOURS.find(x => pick(x) && x.images && x.images.length && !(taken || []).includes(x.images[0]));
    return t ? t.images[0] : '';
  };
  // The style ids ARE the tour categories, so every style shows a tour that really is that style.
  // Resolved once, tracking what is taken, so no two cards end up with the same photo.
  const STYLE_IMG = (() => {
    const out = {}, taken = [];
    STYLES.forEach(s => {
      const url = tourPhoto(t => (t.cats || []).includes(s.id), taken)
        || tourPhoto(t => (t.images || []).length, taken)   // "Not sure yet" has no category
        || unsplash(s.img);
      out[s.id] = url; taken.push(url);
    });
    return out;
  })();
  const styleImg = s => STYLE_IMG[s.id] || unsplash(s.img);

  // ---- matching: filter tours by style + duration ----
  function matchTours() {
    // nights are a number now. The old version compared band ids and returned true for anything it
    // did not recognise, so a numeric value would have silently matched every tour in the catalogue.
    const want = tripNights();
    const inRange = d => !want ? true : Math.abs(d - want) <= 2;
    const scored = TOURS.map(t => {
      let s = 0;
      if (S.style && S.style !== 'notsure' && t.cats.includes(S.style)) s += 2;
      if (S.style === 'Combined' && /trekking|horse/i.test(t.activities)) s += 1;
      if (inRange(t.days)) s += 2;
      // effort and comfort used to be collected and then ignored; they steer the shortlist now
      if (S.effort && S.effort !== 'guide' && t.tour_speed) {
        const easy = /relax|easy|slow/i.test(t.tour_speed), hard = /fast|active|intense/i.test(t.tour_speed);
        if (S.effort === '2-3h' && easy) s += 1;
        if (S.effort === '6h+' && hard) s += 1;
        if (S.effort === '4-5h' && !easy && !hard) s += 1;
      }
      if (S.comfort && t.accommodations) {
        const basic = /yurt|homestay|tent/i.test(t.accommodations), hotel = /hotel|guesthouse/i.test(t.accommodations);
        if (S.comfort === 'Authentic' && basic) s += 1;
        if (S.comfort === 'Comfortable' && hotel) s += 1;
        if (S.comfort === 'Mixed' && basic && hotel) s += 1;
      }
      // a traveller who would rather not ride should not be shown horse-first routes
      if (S.riding === 'norides' && /horse/i.test((t.activities || '') + t.cats.join(' '))) s -= 2;
      return { t, s };
    }).sort((a, b) => b.s - a.s);
    return scored.filter(x => x.s > 0).slice(0, 3).map(x => x.t);
  }

  // ---- render ----
  const el = id => document.getElementById(id);
  // scrollTop only when the step changes: doing it on every render meant that picking an option
  // yanked the page to the top mid-answer
  function render(toTop) {
    document.body.dataset.step = step;   // the mobile action bar unpins on the last step
    renderBar(); renderStep(); renderSummary(); save();
    if (toTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderBar() {
    el('stepsBar').setAttribute('role', 'progressbar');
    el('stepsBar').setAttribute('aria-valuenow', step + 1);
    el('stepsBar').setAttribute('aria-valuemin', 1);
    el('stepsBar').setAttribute('aria-valuemax', STEPS.length);
    el('stepsBar').setAttribute('aria-label', `Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`);
    el('stepsBar').innerHTML = STEPS.map((_, i) => `<div class="sstep ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}"></div>`).join('');
  }

  function header(label, h, sub) {
    return `<div class="step-label">Step ${step + 1} of ${STEPS.length} · ${label}</div><h1 class="step-h">${h}</h1><p class="step-sub">${sub}</p>`;
  }
  function navBtns(canSkip) {
    return `<div class="builder-nav">
      <button class="btn btn-ghost" ${step === 0 ? 'disabled' : ''} onclick="BUILDER.back()">← Back</button>
      ${canSkip ? '<button class="skip" onclick="BUILDER.next()">Skip this step</button>' : ''}
      <button class="btn btn-primary" onclick="BUILDER.next()">${step === STEPS.length - 1 ? 'Done' : 'Continue'}</button>
    </div>`;
  }

  function renderStep() {
    const a = el('stepArea');
    if (step === 0) {
      a.innerHTML = header('Trip style', "What kind of adventure?", "Pick the vibe that excites you most. Not sure? Choose “Not sure yet” and we'll suggest.") +
        askLine('style') +
        `<div class="opt-cards${flag('style')}">${STYLES.map(s => `
          <button class="opt-card ${S.style === s.id ? 'sel' : ''}" onclick="BUILDER.set('style','${s.id}')">
            <span class="tick"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg></span>
            <span class="im"><img loading="lazy" src="${styleImg(s)}" alt="${s.t}"></span>
            <span class="tx"><b>${s.t}</b><span>${s.d}</span></span>
          </button>`).join('')}</div>` + navBtns(false);
    }
    else if (step === 1) {
      const exact = S.whenMode === 'exact';
      const nights = exact && S.dateFrom && S.dateTo ? nightsBetween(S.dateFrom, S.dateTo) : S.nights;
      // the tab bar reuses the catalog's segmented control so it looks like the rest of the site
      const tabs = `<div class="msort-seg when-seg" role="tablist" aria-label="How you'd like to give us your dates">
          <button role="tab" aria-selected="${!exact}" class="${!exact ? 'sel' : ''}" onclick="BUILDER.setWhenMode('months')">Months</button>
          <button role="tab" aria-selected="${exact}" class="${exact ? 'sel' : ''}" onclick="BUILDER.setWhenMode('exact')">Exact dates</button>
        </div>`;
      // nights as a stepper, the same control as the traveller counts, plus a real numeric field so
      // a 14-night traveller types instead of tapping thirteen times
      const nightsRow = `<div class="stepper nights-row">
          <div class="lab"><b>Nights</b><span>${exact ? 'From your dates' : "Roughly, we'll fine-tune"}</span></div>
          <div class="ctrl">
            <button type="button" tabindex="-1" aria-label="One night fewer" onclick="BUILDER.bump('nights',-1)">−</button>
            <input class="val" id="vNights" type="text" inputmode="numeric" pattern="[0-9]*" role="spinbutton"
              aria-label="Number of nights" aria-valuenow="${nights}" aria-valuemin="1" aria-valuemax="30"
              value="${nights}" ${exact ? 'readonly' : ''} oninput="BUILDER.typeNights(this.value)">
            <button type="button" tabindex="-1" aria-label="One night more" onclick="BUILDER.bump('nights',1)">+</button>
          </div>
        </div>`;
      const monthsBlock = `
        <div class="field-group"><label>Which months work for you?</label>
          <div class="month-grid${flag('when')}">${MONTHS.map(m => `
            <button class="b-chip month-chip ${S.months.includes(m.id) ? 'sel' : ''}" aria-pressed="${S.months.includes(m.id)}"
              onclick="BUILDER.toggleMonth('${m.id}')">${m.short}<small>${m.year}</small></button>`).join('')}</div>
          <button class="choice flex-row ${S.anyMonth ? 'sel' : ''}" aria-pressed="${S.anyMonth}" onclick="BUILDER.set('anyMonth',${!S.anyMonth})">
            <span class="ic"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.1 4.8 5.2.5-3.9 3.5 1.1 5.1L12 14.3 7.5 16.9l1.1-5.1L4.7 8.3l5.2-.5Z"/></svg></span>
            <b>I'm flexible</b><span>Suggest the best season for this route</span>
          </button>
          ${askLine('when')}
        </div>`;
      const exactBlock = `
        <div class="field-group"><label>Your dates</label>
          <div class="date-row${flag('when')}">
            <div class="field"><label for="dFrom">Arrive</label><input id="dFrom" type="date" value="${S.dateFrom}" onchange="BUILDER.setDate('dateFrom',this.value)"></div>
            <div class="field"><label for="dTo">Leave</label><input id="dTo" type="date" value="${S.dateTo}" onchange="BUILDER.setDate('dateTo',this.value)"></div>
          </div>
          ${S.dateFrom && S.dateTo && nights > 0 ? `<p class="date-note">${nights} nights, we'll build the route around these dates</p>` : ''}
          ${askLine('when')}
        </div>`;
      a.innerHTML = header('When & who', "When would you like to go?", "Rough answers are fine, everything is tailor-made around you.") +
        tabs +
        `<div class="field-group"><label>How many nights?</label><div class="steppers">${nightsRow}</div></div>` +
        (exact ? exactBlock : monthsBlock) +
        `<div class="field-group"><label>Who's coming?</label><div class="steppers">
           <div class="stepper"><div class="lab"><b>Adults</b><span>13+ years</span></div><div class="ctrl"><button type="button" aria-label="One adult fewer" onclick="BUILDER.bump('adults',-1)">−</button><span class="val" id="vAdults">${S.adults}</span><button type="button" aria-label="One adult more" onclick="BUILDER.bump('adults',1)">+</button></div></div>
           <div class="stepper"><div class="lab"><b>Children</b><span>0-12 years</span></div><div class="ctrl"><button type="button" aria-label="One child fewer" onclick="BUILDER.bump('children',-1)">−</button><span class="val" id="vChildren">${S.children}</span><button type="button" aria-label="One child more" onclick="BUILDER.bump('children',1)">+</button></div></div>
         </div></div>` + navBtns(false);
    }
    else if (step === 2) {
      const choices = (list, key) => `<div class="choice-cards">${list.map(o => `<button class="choice ${S[key] === o.id ? 'sel' : ''}" aria-pressed="${S[key] === o.id}" onclick="BUILDER.set('${key}','${o.id}')"><span class="ic">${o.ic}</span><b>${o.t}</b><span>${o.d}</span></button>`).join('')}</div>`;
      a.innerHTML = header('Your style', "How do you like to travel?", "This is what tells us whether to send you the gentle version of a route or the demanding one.") +
        `<div class="field-group"><label>How long in the saddle or on foot each day?</label>${choices(EFFORT, 'effort')}</div>
         ${ridingAsked() ? `<div class="field-group"><label>How much riding have you done?</label>${choices(RIDING, 'riding')}</div>` : ''}
         <div class="field-group"><label>Where would you like to sleep?</label>${choices(COMFORT, 'comfort')}</div>` + navBtns(true);
    }
    else if (step === 3) {
      const matches = matchTours();
      const matchHTML = matches.length ? `
        <div class="field-group"><label>Tours that match your choices, pick one as a starting point (optional)</label>
        <div class="match-list">
          ${matches.map(t => `<div class="match ${S.base === t.slug ? 'sel' : ''}" onclick="BUILDER.set('base','${t.slug}')">
            <img loading="lazy" src="${t.images && t.images[0] ? t.images[0] : unsplash('1506905925346-21bda4d32df4')}" alt="${t.name}">
            <div class="mb"><b>${t.name}</b><span>${t.duration} · ${t.cats.join(', ')}</span></div><span class="tick"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg></span></div>`).join('')}
          <div class="match ${S.base === 'custom' ? 'sel' : ''}" onclick="BUILDER.set('base','custom')">
            <div style="width:96px;height:72px;border-radius:10px;background:var(--paper-2);display:grid;place-items:center;flex:none;font-size:1.6rem"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.7 5.3L19 11l-5.3 1.7L12 18l-1.7-5.3L5 11l5.3-1.7Z"/></svg></div>
            <div class="mb"><b>Build it fully custom</b><span>Start from a blank canvas around my choices</span></div><span class="tick"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg></span></div>
        </div></div>` : '';
      a.innerHTML = header('Review & send', "Your trip, ready to plan", "Check the summary, add your details, and a local expert sends a tailored plan within 24 hours. Free, no prepayment.") +
        matchHTML +
        `<div class="form-card builder-form">
          <form id="bForm" novalidate>
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
            <p style="color:var(--ink-soft)" id="bSuccessLine">A local expert will email you within 24 hours with a tailored plan.</p>
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px">
              <a href="tours.html" class="btn btn-primary">Browse tours while you wait</a>
              <a href="plan-trip.html" class="btn btn-dark">Read the travel guide</a>
            </div>
          </div>
        </div>` +
        `<div class="builder-nav"><button class="btn btn-ghost" style="border-color:var(--line);color:var(--ink)" onclick="BUILDER.back()">← Back</button><span></span></div>`;
      wireForm();
    }
  }

  const label = (list, id) => (list.find(o => o.id === id) || {}).t || id;
  const travellers = () => S.adults + ' adult(s)' + (S.children ? ', ' + S.children + ' child(ren)' : '');
  const tripNights = () => (S.whenMode === 'exact' && S.dateFrom && S.dateTo) ? nightsBetween(S.dateFrom, S.dateTo) : S.nights;
  const nightsText = () => { const n = tripNights(); return n ? n + ' nights' : ''; };

  function summaryText() {
    const lines = [];
    lines.push('TRIP BUILDER REQUEST');   // was a stray ", AZAT TOURS TRIP REQUEST, " from a dash sweep
    if (S.style) lines.push('Style: ' + (S.style === 'notsure' ? 'Not sure / suggest' : S.style));
    if (nightsText()) lines.push('Length: ' + nightsText());
    if (whenText()) lines.push('When: ' + whenText());
    lines.push('Travellers: ' + travellers());
    if (S.effort) lines.push('Daily effort: ' + label(EFFORT, S.effort));
    if (S.riding) lines.push('Riding experience: ' + label(RIDING, S.riding));
    if (S.comfort) lines.push('Comfort: ' + S.comfort);
    if (S.base && S.base !== 'custom') { const t = TOURS.find(x => x.slug === S.base); if (t) lines.push('Based on: ' + t.name); }
    if (S.base === 'custom') lines.push('Based on: fully custom');
    return lines.join('\n');
  }

  function renderSummary() {
    const row = (k, v) => `<div class="sum-row"><span class="k">${k}</span><span class="v ${v ? '' : 'empty'}">${v || 'Any'}</span></div>`;
    const base = S.base === 'custom' ? 'Fully custom' : (S.base ? (TOURS.find(x => x.slug === S.base) || {}).name : '');
    el('summary').innerHTML = `
      <h3>Your trip so far</h3>
      <p class="muted">Builds as you choose, nothing is final.</p>
      ${row('Style', S.style === 'notsure' ? 'Suggest for me' : S.style)}
      ${row('Length', nightsText())}
      ${row('When', whenText())}
      ${row('Travellers', S.adults + (S.children ? '+' + S.children + ' kids' : ' adults'))}
      ${row('Daily effort', S.effort ? label(EFFORT, S.effort) : '')}
      ${row('Riding', S.riding ? label(RIDING, S.riding) : '')}
      ${row('Comfort', S.comfort)}
      ${base ? row('Base tour', base) : ''}
      ${step < STEPS.length - 1 ? `<button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:18px" onclick="BUILDER.jumpToEnd()">Skip to request</button>` : ''}`;
  }

  // The browser's own "fill in this field" bubble is localised to the BROWSER's language, so it
  // shows up in Russian on a Russian Chrome even though the page is English, and it looks like a
  // system popup on a designed form. The form carries novalidate and we say it ourselves, in the
  // same voice and the same .form-err row the step questions already use.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;   // matches the server's rule in server.js
  function fieldError(input, message) {
    clearError(input);
    if (!message) return;
    const id = input.id + 'Err';
    const p = document.createElement('p');
    p.className = 'form-err'; p.id = id; p.setAttribute('role', 'alert');
    p.textContent = message;
    input.closest('.field').appendChild(p);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', id);
  }
  function clearError(input) {
    const old = document.getElementById(input.id + 'Err');
    if (old) old.remove();
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }

  function wireForm() {
    const f = el('bForm'); if (!f) return;
    const sync = () => { S.name = el('bname').value; S.email = el('bemail').value; S.whatsapp = el('bwa').value; save(); updateWa(); };
    ['bname', 'bemail', 'bwa'].forEach(id => el(id).addEventListener('input', sync));
    // typing is the moment someone is fixing the problem, so the warning goes away then
    ['bname', 'bemail'].forEach(id => el(id).addEventListener('input', () => clearError(el(id))));
    updateWa();
    f.addEventListener('submit', async e => {
      e.preventDefault(); sync();

      const name = el('bname'), email = el('bemail');
      const nameMsg = S.name.trim() ? '' : "We need a name so we know who we're writing to.";
      const emailMsg = !S.email.trim()
        ? 'We need an email to send your plan to.'
        : (EMAIL_RE.test(S.email.trim()) ? '' : "That email doesn't look right, could you check it?");
      fieldError(name, nameMsg);
      fieldError(email, emailMsg);
      if (nameMsg || emailMsg) { (nameMsg ? name : email).focus(); return; }

      const btn = f.querySelector('button[type="submit"]'); const orig = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      const bot = f.querySelector('[name="botcheck"]');
      const payload = {
        name: S.name, email: S.email, whatsapp: S.whatsapp,
        tour: 'Trip Builder request', trip_summary: summaryText(),
        // the Telegram template already renders these as their own lines; the builder never filled
        // them, so travellers and dates were buried inside the summary block
        people: travellers(),
        dates: [whenText(), nightsText()].filter(Boolean).join(', '),
        botcheck: bot && bot.checked ? 1 : ''   // the server drops leads that fill this
      };
      try {
        const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await r.json();
        if (j.ok) {
          // name is read here, not when step 5 rendered, so it matches what was actually typed
          const first = (S.name || '').trim().split(' ')[0];
          const line = el('bSuccessLine');
          if (line && first) line.textContent = `A local expert will email you within 24 hours with a tailored plan, ${first}.`;
          f.style.display = 'none'; el('bSuccess').classList.add('show'); localStorage.removeItem(LS);
        }
        else throw new Error();
      } catch (err) {
        btn.disabled = false; btn.textContent = orig;
        let er = f.querySelector('.form-err');
        if (!er) { er = document.createElement('p'); er.className = 'form-err'; er.setAttribute('role', 'alert'); btn.insertAdjacentElement('afterend', er); }
        er.innerHTML = "Couldn't send that just now. Please <a href=\"https://wa.me/996502888001\" target=\"_blank\" rel=\"noopener\">send it on WhatsApp</a> instead.";
      }
    });
  }
  function updateWa() {
    const wa = el('waSend'); if (!wa) return;
    const txt = summaryText() + (S.name ? '\n\nName: ' + S.name : '') + (S.email ? '\nEmail: ' + S.email : '');
    wa.href = 'https://wa.me/996502888001?text=' + encodeURIComponent(txt);
  }

  // ---- public API ----
  window.BUILDER = {
    set(k, v) {
      S[k] = (S[k] === v && k !== 'base' && typeof v !== 'boolean') ? '' : v;
      if (k === 'anyMonth' && S.anyMonth) S.months = [];   // one answer or the other, not both
      if (k === 'anyMonth' || k === 'months') invalid = invalid.filter(x => x !== 'when');
      invalid = invalid.filter(x => x !== k || !S[k]);
      render();
    },
    bump(k, d) {
      const floor = k === 'adults' ? 1 : k === 'nights' ? 1 : 0;
      const ceil = k === 'nights' ? 30 : 20;
      S[k] = Math.max(floor, Math.min(ceil, (Number(S[k]) || 0) + d));
      if (k === 'nights') invalid = invalid.filter(x => x !== 'when');
      render();
    },
    // typed nights: keep the field usable while half-typed, clamp only on a real number
    typeNights(v) {
      const n = parseInt(String(v).replace(/\D/g, ''), 10);
      if (!isFinite(n)) return;
      S.nights = Math.max(1, Math.min(30, n));
      save(); renderSummary();
    },
    setWhenMode(mode) { S.whenMode = mode; invalid = invalid.filter(x => x !== 'when'); render(); },
    toggleMonth(id) {
      const i = S.months.indexOf(id);
      if (i >= 0) S.months.splice(i, 1); else { S.months.push(id); S.anyMonth = false; }
      S.months.sort();
      invalid = invalid.filter(x => x !== 'when' || !S.months.length);
      render();
    },
    setDate(k, v) {
      S[k] = v;
      // a leave date before the arrival date is a slip, not an intention
      if (S.dateFrom && S.dateTo && new Date(S.dateTo) <= new Date(S.dateFrom)) {
        if (k === 'dateFrom') S.dateTo = ''; else S.dateTo = '';
      }
      if (S.dateFrom && S.dateTo) { S.nights = nightsBetween(S.dateFrom, S.dateTo); invalid = invalid.filter(x => x !== 'when'); }
      render();
    },
    next() {
      const gaps = missing(step);
      if (gaps.length) {
        // stay on the step and say what is missing, rather than sending an empty request
        invalid = gaps; render();
        const first = document.querySelector('.needs-pick');
        if (first) first.scrollIntoView({ block: 'center' });
        return;
      }
      invalid = [];
      if (step < STEPS.length - 1) { step++; render(true); }
    },
    back() { if (step > 0) { invalid = []; step--; render(true); } },
    jumpToEnd() { invalid = []; step = STEPS.length - 1; render(true); }
  };

  render();
})();
