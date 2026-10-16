// Server-side render of a rental car page (/cars/<slug>/). Same layout family as a
// tour page (lib/tour-page.js): photo hero with the price, then photos, specs,
// prices, terms, questions and the request form. Facts come only from the fields
// the owner filled in the admin bot; empty fields are left out, nothing is invented.
const { esc, asset, carUrl, thumbUrl, seatsText, carFrom, carCard, FALLBACK_IMG } = require('../public/cards');
const { ORIGIN, abs, clipDesc } = require('./tour-page');

const WA_NUMBER = '996502888001';
const waLink = c => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Hi Azat Tours! I'd like to rent the " + c.name + '. My dates are: ')}`;
const waIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.4Z"/></svg>';
const lockIcon = '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const okIcon = '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>';

const has = n => n > 0;
const specLine = c => [c.type, c.transmission, c.drive, c.fuel, c.seats ? seatsText(c.seats) + ' seats' : ''].filter(Boolean).join(', ');

// Generated description when the owner left none (facts only).
function carSummary(c) {
  if (c.summary) return c.summary;
  const modes = has(c.priceSelf) && has(c.priceDriver) ? 'self-drive or with a driver' : has(c.priceSelf) ? 'self-drive' : 'with a driver';
  return `${c.name}${specLine(c) ? ' (' + specLine(c).toLowerCase() + ')' : ''}, for rent in Kyrgyzstan ${modes}.`;
}

// SEO <title>, at most 60 characters.
function carTitle(c) {
  for (const t of [`${c.name} for rent in Kyrgyzstan | Azat Tours`, `${c.name} rental, Kyrgyzstan | Azat Tours`, `${c.name} for rent | Azat Tours`]) if (t.length <= 60) return t;
  return `${c.name} for rent`;
}

// Questions answered from real fields only (one source for the accordion and FAQPage).
function carFaqs(c) {
  const out = [];
  if (has(c.priceSelf) && has(c.priceDriver)) out.push(['Can I rent it without a driver?', `Yes. Self-drive costs $${c.priceSelf} per day, or $${c.priceDriver} per day with one of our drivers.`]);
  else if (has(c.priceSelf)) out.push(['Is it self-drive only?', `Yes, this car is rented without a driver, at $${c.priceSelf} per day.`]);
  else if (has(c.priceDriver)) out.push(['Can I drive it myself?', `No, this car comes with one of our drivers, at $${c.priceDriver} per day.`]);
  if (has(c.minDays)) out.push(['What is the minimum rental?', `${c.minDays} day${c.minDays > 1 ? 's' : ''}.`]);
  if (has(c.deposit)) out.push(['Is there a deposit?', `Yes, $${c.deposit}. We go through the deposit and the rental terms when we confirm your dates.`]);
  out.push(['How do I book it?', 'Send your dates with the form on this page or on WhatsApp. We confirm availability and the total price within 24 hours. Asking is free.']);
  return out;
}

function carMeta(c) {
  const url = ORIGIN + carUrl(c.slug);
  const image = abs((c.images && c.images[0]) || FALLBACK_IMG);
  const desc = clipDesc(carSummary(c) + (isFinite(carFrom(c)) ? ` From $${carFrom(c)} per day. We confirm availability within 24 hours.` : ''));
  const offer = (name, price) => ({
    '@type': 'Offer', name, price, priceCurrency: 'USD', url,
    priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: 'USD', unitCode: 'DAY', unitText: 'day' },
    availability: c.available === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    seller: { '@type': 'TravelAgency', '@id': ORIGIN + '/#organization', name: 'Azat Tours' }
  });
  const offers = [has(c.priceSelf) && offer('Self-drive, per day', c.priceSelf), has(c.priceDriver) && offer('With a driver, per day', c.priceDriver)].filter(Boolean);
  const faqs = carFaqs(c);
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'Product', additionalType: 'https://schema.org/Car',
      name: c.name, description: carSummary(c), url, sku: c.slug,
      image: (c.images || []).length ? c.images.map(abs) : [image],
      brand: c.make ? { '@type': 'Brand', name: c.make } : undefined,
      model: c.model || undefined, productionDate: c.year ? String(c.year) : undefined,
      offers: offers.length ? offers : undefined
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: 'Car rental', item: ORIGIN + '/cars/' },
        { '@type': 'ListItem', position: 3, name: c.name, item: url }
      ]
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } }))
    }
  ];
  return { title: carTitle(c), desc, url, image, ogType: 'website', jsonld };
}

// Full <main> content. CARS = all published cars (for "Other cars").
function carBody(c, CARS) {
  const name = esc(c.name);
  const wa = waLink(c);
  const from = carFrom(c);
  const booked = c.available === false;
  const imgs = (c.images || []).length ? c.images : [FALLBACK_IMG];

  const facts = [
    has(c.priceSelf) && [`$${c.priceSelf} / day`, 'Self-drive'],
    has(c.priceDriver) && [`$${c.priceDriver} / day`, 'With driver'],
    c.seats && [seatsText(c.seats), 'Seats'],
    c.year && [String(c.year), 'Year']
  ].filter(Boolean);
  const pills = [c.type, c.drive, c.transmission].filter(Boolean).map(p => `<span class="pill">${esc(p)}</span>`).join('') +
    `<span class="pill${booked ? ' sale' : ''}">${booked ? 'Booked now, ask for dates' : 'Available'}</span>`;

  const photos = (c.images || []).length > 1 ? `
        <section class="reveal in">
          <h2>Photos</h2>
          <div class="gallery car-strip">${c.images.map((im, i) =>
            `<a href="${asset(im)}" target="_blank" rel="noopener"><img loading="lazy" src="${thumbUrl(im)}" alt="${name}, photo ${i + 1}"></a>`).join('')}</div>
        </section>` : '';

  const specs = [
    ['Type', c.type], ['Gearbox', c.transmission], ['Drive', c.drive], ['Fuel', c.fuel],
    ['Seats', c.seats ? seatsText(c.seats) : ''], ['Year', c.year || ''],
    ['Minimum rental', has(c.minDays) ? `${c.minDays} day${c.minDays > 1 ? 's' : ''}` : ''],
    ['Deposit', has(c.deposit) ? `$${c.deposit}` : '']
  ].filter(s => s[1]);
  const specsHTML = specs.length ? `
        <section class="reveal in">
          <h2>Specs</h2>
          <div class="car-specs">${specs.map(([k, v]) => `<div class="cs"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
        </section>` : '';

  const priceCard = (label, p, note) => `<div class="cp"><span>${label}</span><b>$${p}</b><em>${note}</em></div>`;
  const pricesHTML = `
        <section class="reveal in">
          <h2>Price per day</h2>
          <div class="car-prices">
            ${has(c.priceSelf) ? priceCard('Self-drive', c.priceSelf, 'you drive') : ''}
            ${has(c.priceDriver) ? priceCard('With a driver', c.priceDriver, 'one of our drivers') : ''}
          </div>
          <p class="car-note">Renting for a week or longer? Ask us for a weekly price.</p>
        </section>`;

  const features = (c.features || []).filter(Boolean);
  const terms = String(c.terms || '').split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean);
  const termsHTML = (features.length || terms.length) ? `
        <section class="reveal in">
          <h2>${features.length && terms.length ? 'Included and rental terms' : features.length ? "What's included" : 'Rental terms'}</h2>
          <div class="incl-grid${features.length && terms.length ? '' : ' one'}">
            ${features.length ? `<ul class="yes">${features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
            ${terms.length ? `<ul class="tour-notes">${terms.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          </div>
        </section>` : '';

  const faqs = carFaqs(c);
  const faqHTML = `
        <section class="reveal in">
          <h2>Common questions</h2>
          <div>${faqs.map(f => `
            <div class="faq-item">
              <button class="tfaq-q">${f[0]}<span class="ic">+</span></button>
              <div class="faq-a"><p>${f[1]}</p></div>
            </div>`).join('')}
          </div>
        </section>`;

  const others = (CARS || []).filter(x => x.slug !== c.slug).slice(0, 3);
  const othersHTML = `
        <section class="reveal in related-tours" style="border-bottom:0">
          ${others.length ? `<h2>Other cars</h2><div class="tours-grid">${others.map(carCard).join('')}</div>` : ''}
          <p class="car-note">Prefer to be driven around the whole country? <a href="/tours/">See our tours</a>, transport and a local guide are included.</p>
        </section>`;

  return `
  <section class="tour-hero car-hero">
    <div class="bg"><img src="${asset(imgs[0])}" fetchpriority="high" alt="${name} for rent in Kyrgyzstan" /></div>
    <div class="wrap">
      <p class="crumb reveal in"><a href="/">Home</a> / <a href="/cars/">Car rental</a> / ${name}</p>
      <div class="badges reveal in">${pills}</div>
      <h1 class="reveal in">${name}</h1>
      <p class="sub reveal in">${esc(carSummary(c))}</p>
      ${facts.length ? `<div class="factbar reveal in">${facts.map(f => `<div class="f"><b>${f[0]}</b><span>${f[1]}</span></div>`).join('')}</div>` : ''}
    </div>
  </section>

  <section class="pad">
    <div class="wrap">
      <div class="tour-main">
        ${photos}
        ${specsHTML}
        ${pricesHTML}
        ${termsHTML}
        ${faqHTML}

        <section id="book" class="reveal in">
          <h2>Request this car</h2>
          <p>Tell us your dates and we'll confirm availability and the total price within 24 hours. Asking is free.</p>
          <div class="book-grid">
          <div class="form-card" style="box-shadow:var(--shadow);padding:30px">
            <form id="leadForm">
              <input type="checkbox" name="botcheck" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true" />
              <input type="hidden" name="tour" value="${esc('Car rental: ' + c.name).replace(/"/g, '&quot;')}" />
              <div class="field"><label for="name">Full name</label><input id="name" name="name" type="text" placeholder="Jane Traveller" required /></div>
              <div class="field-row">
                <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" placeholder="you@email.com" required /></div>
                <div class="field"><label for="people">Passengers</label><select id="people" name="people"><option>1</option><option>2</option><option>3-4</option><option>5-7</option><option>8+</option></select></div>
              </div>
              <div class="field"><label for="dates">Pick-up and return dates</label><input id="dates" name="dates" type="text" placeholder="e.g. 12 to 18 July 2026" /></div>
              <div class="field"><label for="msg">Anything else?</label><textarea id="msg" name="msg" placeholder="${has(c.priceSelf) && has(c.priceDriver) ? 'Self-drive or with a driver, where' : 'Where'} to pick it up, child seat, questions…"></textarea></div>
              <button type="submit" class="btn btn-primary">Send request</button>
              <a href="${wa}" target="_blank" rel="noopener" class="form-wa">${waIcon} WhatsApp</a>
              <p class="form-note">${lockIcon} We reply within 24h. No spam.</p>
            </form>
            <div class="form-success" id="formSuccess">
              <div class="big">${okIcon}</div><h3>Request received!</h3>
              <p style="color:var(--ink-soft)">We'll email you within 24 hours about the ${name}.</p>
            </div>
          </div>
          <aside class="book-side">
            <div class="book-price"><span>Price</span><b>${isFinite(from) ? `from $${from}` : 'On request'}</b><em>per day${has(c.minDays) ? `, minimum ${c.minDays} day${c.minDays > 1 ? 's' : ''}` : ''}</em></div>
            <ul class="book-perks">
              <li>Talk to a real local, not a call centre</li>
              <li>Free to ask, we confirm within 24 hours</li>
              ${has(c.priceDriver) ? '<li>A local driver who knows the roads, if you want one</li>' : ''}
            </ul>
            <div class="book-contact">
              <a href="${wa}" target="_blank" rel="noopener" class="wa">${waIcon} WhatsApp</a>
            </div>
          </aside>
          </div>
        </section>
        ${othersHTML}
      </div>
    </div>
  </section>`;
}

module.exports = { carMeta, carBody, carFaqs, carSummary, carTitle, waLink };
