// Plain-text versions of the site for AI assistants and agents:
//   /llms.txt            short map of the site (llmstxt.org format)
//   /llms-full.txt       every tour and article in one Markdown file
//   /tours/<slug>.md     one tour      /blog/<slug>.md   one article
// Same facts as the HTML pages, straight from content/*.json, nothing added.
const { tourUrl, postUrl, carUrl, seatsText } = require('../public/cards');
const { carFaqs, carSummary } = require('./car-page');
const { ORIGIN, tourFaqs } = require('./tour-page');
const { cleanHref } = require('./post-page');

const CONTACT = [
  '- WhatsApp and phone: +996 502 888 001 (https://wa.me/996502888001)',
  '- Email: azatbeyshenaliev1@gmail.com',
  '- Instagram: https://www.instagram.com/azattourskg/',
  '- Enquiry form: ' + ORIGIN + '/#plan',
  '- Based in Bishkek, Kyrgyzstan',
].join('\n');
const ABOUT = 'Azat Tours is a local tour company in Bishkek, Kyrgyzstan. Azat, the founder, has guided travellers across the country since 2019. ' +
  'We run small-group and private trips: horse treks, road trips, trekking and combined routes, with nights in yurts, guesthouses and hotels. ' +
  'Every itinerary can be tailored to your dates, pace and fitness. Some tours list a starting price per person; the exact price for your group size and season is confirmed on request. Enquiring is free and needs no prepayment, and we reply within 24 hours.';

const plain = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const fact = (k, v) => v ? `- ${k}: ${plain(v)}` : null;

function tourFacts(t) {
  return [
    fact('Duration', t.duration || ((t.itinerary || []).length + ' days')),
    fact('Type', (t.cats || []).join(', ')),
    fact('Best season', t.season),
    fact('Starts and ends in', t.start_from),
    fact('Pace', t.tour_speed),
    fact('Activities', t.activities),
    fact('Accommodation', t.accommodations),
    fact('Total driving', t.total_drive && t.total_drive !== '0 km' ? t.total_drive : ''),
    t.priceFrom > 0
      ? `- Price: from $${t.priceFrom} per person (the exact price depends on group size and season). No prepayment to enquire.`
      : '- Price: on request (depends on group size, season and options). Free quote, no prepayment to enquire.',
    '- Group: small group or fully private, with a local English-speaking guide',
  ].filter(Boolean).join('\n');
}

function tourMd(t, level) {
  const h = '#'.repeat(level || 1);
  const url = ORIGIN + tourUrl(t.slug);
  const out = [`${h} ${t.name}`, '', plain(t.summary || (t.blurb && t.blurb.text) || ''), '', tourFacts(t), `- Page: ${url}`];
  if ((t.highlights || []).length) out.push('', `${h}# Highlights`, '', t.highlights.map(x => '- ' + plain(x)).join('\n'));
  out.push('', `${h}# Itinerary`);
  for (const d of t.itinerary || []) {
    out.push('', `${h}## Day ${d.day}: ${plain(d.title)}`, '');
    const desc = Array.isArray(d.desc) ? d.desc : (d.desc ? [d.desc] : []);
    desc.filter(Boolean).forEach(p => out.push(plain(p), ''));
    const rows = [fact('Transfer', d.transfer || d.drive), fact('Activity', d.activity), fact('Meals', d.meals), fact('Overnight', d.overnight)].filter(Boolean);
    if (rows.length) out.push(rows.join('\n'));
  }
  const faqs = tourFaqs(t);
  if (faqs.length) { out.push('', `${h}# Common questions`); faqs.forEach(f => out.push('', `**${f[0]}** ${f[1]}`)); }
  out.push('', `${h}# How to book`, '', `Send your dates and group size and we confirm availability and a tailored price within 24 hours: ${url}#book`, '', CONTACT);
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

function postMd(p, resolveTour, level) {
  const h = '#'.repeat(level || 1);
  const abs = href => { const c = cleanHref(href, resolveTour); return c.charAt(0) === '/' ? ORIGIN + c : c; };
  const body = String(p.body || '').replace(/\r\n/g, '\n').split('\n').map(line => {
    const l = line.trim(); let m;
    if ((m = l.match(/^\[img:([^|\]]+)(?:\|([^\]]*))?\]$/))) return m[2] ? `*Photo: ${m[2]}*` : '';
    if ((m = l.match(/^\[tip:([^|\]]+)\|([^\]]*)\]$/))) return `> **${m[1]}** ${m[2]}`;
    if (level && /^#{2,3} /.test(l)) return '#'.repeat(level) + l;           // nest under the article heading
    return l;
  }).join('\n').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, href) => `[${t}](${abs(href)})`);
  const faqs = (Array.isArray(p.faq) ? p.faq : []).filter(f => f && f.q && f.a);
  const out = [`${h} ${p.title}`, '', [p.author && 'By ' + p.author, p.date && 'published ' + p.date, (p.updated || p.updatedAt) && 'updated ' + (p.updated || p.updatedAt)].filter(Boolean).join(', '),
    `Page: ${ORIGIN + postUrl(p.slug)}`, '', body];
  if (faqs.length) { out.push('', `${h}# Common questions`); faqs.forEach(f => out.push('', `**${f.q}** ${f.a}`)); }
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

// One rental car (/cars/<slug>.md): same facts as the page, only what the owner filled in.
function carMd(c) {
  const url = ORIGIN + carUrl(c.slug);
  const facts = [
    fact('Type', c.type), fact('Gearbox', c.transmission), fact('Drive', c.drive), fact('Fuel', c.fuel),
    fact('Seats', c.seats ? seatsText(c.seats) : ''), fact('Year', c.year || ''),
    c.priceSelf > 0 ? `- Self-drive: $${c.priceSelf} per day` : null,
    c.priceDriver > 0 ? `- With a driver: $${c.priceDriver} per day` : null,
    c.minDays > 0 ? `- Minimum rental: ${c.minDays} day(s)` : null,
    c.deposit > 0 ? `- Deposit: $${c.deposit}` : null,
    `- Availability: ${c.available === false ? 'booked at the moment, ask for other dates' : 'available'}`,
    `- Page: ${url}`
  ].filter(Boolean).join('\n');
  const out = [`# ${c.name}`, '', plain(carSummary(c)), '', facts];
  if ((c.features || []).length) out.push('', '## Included', '', c.features.map(f => '- ' + plain(f)).join('\n'));
  if (c.terms) out.push('', '## Rental terms', '', plain(c.terms));
  out.push('', '## Common questions');
  carFaqs(c).forEach(f => out.push('', `**${f[0]}** ${f[1]}`));
  out.push('', '## How to book', '', `Send your dates and we confirm availability and the total price within 24 hours: ${url}#book`, '', CONTACT);
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
const carLine = c => `- [${c.name}](${ORIGIN}/cars/${c.slug}.md): ` +
  [c.type, c.transmission, c.drive, c.seats ? seatsText(c.seats) + ' seats' : ''].filter(Boolean).join(', ') + '; ' +
  [c.priceSelf > 0 && `$${c.priceSelf}/day self-drive`, c.priceDriver > 0 && `$${c.priceDriver}/day with a driver`].filter(Boolean).join(', ');

const tourLine = t => `- [${t.name}](${ORIGIN}/tours/${t.slug}.md): ${[(t.cats || []).join(', '), t.season, t.start_from && 'from ' + t.start_from].filter(Boolean).join('; ')}. ${plain((t.blurb && t.blurb.text) || t.summary || '')}`;

function llmsTxt(tours, posts, cars) {
  const byCat = {};
  tours.forEach(t => { const c = (t.cats && t.cats[0]) || 'Other'; (byCat[c] = byCat[c] || []).push(t); });
  const out = ['# Azat Tours', '', '> ' + ABOUT, '',
    'Tour pages list the full day-by-day itinerary, season, pace, accommodation and common questions. Each link below is a Markdown version of the page.', '',
    '## Contact', '', CONTACT];
  for (const [cat, list] of Object.entries(byCat)) out.push('', `## Tours: ${cat}`, '', list.map(tourLine).join('\n'));
  if ((cars || []).length) out.push('', '## Car rental', '', cars.map(carLine).join('\n'));
  out.push('', '## Travel guides', '', posts.map(p => `- [${p.title}](${ORIGIN}/blog/${p.slug}.md): ${plain(p.excerpt || '')}`).join('\n'));
  out.push('', '## Company', '',
    `- [About Azat Tours](${ORIGIN}/about.html): who we are and how we work`,
    `- [Plan your trip](${ORIGIN}/plan-trip.html): visas, safety, health, packing, money and connectivity in Kyrgyzstan`,
    `- [All tours](${ORIGIN}/tours/): the catalogue with filters by activity, length and season`,
    `- [Trip builder](${ORIGIN}/builder.html): sketch a custom trip and get a tailored plan`,
    `- [Contact](${ORIGIN}/contact.html)`,
    '', '## Optional', '', `- [Everything in one file](${ORIGIN}/llms-full.txt): all tours and guides in full`);
  return out.join('\n') + '\n';
}

function llmsFull(tours, posts, resolveTour) {
  return ['# Azat Tours: all tours and travel guides', '', '> ' + ABOUT, '', '## Contact', '', CONTACT, '',
    '# Tours', '', tours.map(t => tourMd(t, 2)).join('\n---\n\n'),
    '# Travel guides', '', posts.map(p => postMd(p, resolveTour, 2)).join('\n---\n\n')].join('\n');
}

module.exports = { llmsTxt, llmsFull, tourMd, postMd, carMd };
