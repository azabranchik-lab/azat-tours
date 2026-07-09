// LEGACY one-time importer: converts the kyrgyzriders clean export into tours-data.js.
// ⚠ DANGER: writes tours-data.js DIRECTLY, bypassing content/tours.json + lib/content.js.
// Running it reverts blurbs, tags, places, enriched itineraries and bot photos on the site.
// The source of truth is content/tours.json (regenerate via lib/content.js). This script is
// kept only for a cold re-import and is guarded — pass --force to actually run it.
// Run (only if you know what you're doing):  node build-tours.js --force
if (!process.argv.includes('--force')) {
  console.error('Refusing to run: this overwrites tours-data.js and bypasses content/tours.json.\n' +
    'The live source is content/tours.json (edit via bot / merge scripts, regenerate via lib/content.js).\n' +
    'If you really need a cold re-import, re-run with --force.');
  process.exit(1);
}
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'kyrgyzriders_tours_clean.json');
const OUT = path.join(__dirname, 'tours-data.js');

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const decode = s => (s || '')
  .replace(/&#8211;|&#8212;/g, '–').replace(/&#8217;/g, '’').replace(/&#8220;|&#8221;/g, '"')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const VERB = /\s+(?=(?:Enjoy|Immerse|Take|Visit|Explore|Discover|Ride|Hike|Cross|Stay|Experience|Reach|Trek|Relax|Spend|Travel|Witness|Learn|Sleep|Meet|Admire|Venture|Journey|Begin|Set|Test|Traverse)\b)/g;

function season(short) {
  const m = decode(short).match(/Time of year:\s*([A-Za-z]+ to [A-Za-z]+|all year round)/i);
  return m ? m[1].replace(/\ball year round\b/i, 'All year round') : '';
}
function cleanSummary(short) {
  let s = decode(short).replace(/^Tour category:.*?Time of year:\s*(?:[A-Za-z]+ to [A-Za-z]+|all year round)\s*/i, '');
  return s;
}
function whyLove(full) {
  const f = decode(full);
  const m = f.match(/Why you will love this tour\s*(.*?)\s*Itinerary/i);
  if (!m) return [];
  return m[1].split(VERB).map(x => x.trim()).filter(x => x.length > 8).slice(0, 7);
}
function parseItinerary(full, days) {
  const f = decode(full);
  const start = f.search(/\bItinerary\b/i);
  if (start < 0) return [];
  const body = f.slice(start);
  const parts = body.split(/Day\s+(\d+)\s*\.\s*/i); // [pre, num, seg, num, seg, ...]
  const out = [];
  for (let i = 1; i < parts.length; i += 2) {
    const dayNum = parts[i];
    let seg = parts[i + 1] || '';
    // title = text before first bullet "•"; description = bullets until "Transfer:"
    const bulletIdx = seg.indexOf('•');
    let title = (bulletIdx >= 0 ? seg.slice(0, bulletIdx) : seg.split('Transfer:')[0]).trim();
    title = title.replace(/\s*\.\s*$/, '');
    let desc = '';
    if (bulletIdx >= 0) {
      const afterBullets = seg.slice(bulletIdx).split(/Transfer:|NOTES & RECOMMENDATIONS/i)[0];
      desc = afterBullets.split('•').map(s => s.trim()).filter(Boolean).join(' ');
    }
    const meals = (seg.match(/Meals:\s*([^]*?)\s*Overnight:/i) || [])[1];
    const overnight = (seg.match(/Overnight:\s*([^]*?)\s*(?:WC:|Internet:|Shower:|NOTES|$)/i) || [])[1];
    const drive = (seg.match(/Transfer:\s*Total:\s*([0-9]+\s*km[^A-Z]*?)(?:Asphalt|Horse|Trekking|Meals|$)/i) || [])[1];
    out.push({
      day: Number(dayNum),
      title: title.slice(0, 90),
      desc: desc.slice(0, 700),
      meals: meals ? decode(meals) : '',
      overnight: overnight ? decode(overnight) : '',
      drive: drive ? decode(drive).replace(/\s*–\s*$/, '') : ''
    });
    if (days && out.length >= days) break; // stop once we have all days (avoids duplicated tail)
  }
  return out;
}
function categories(cat) {
  return decode(cat).split(/\||,/).map(s => s.trim()).filter(Boolean);
}
function days(duration) {
  const m = (duration || '').match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

const tours = raw.map(t => ({
  id: t.id,
  name: decode(t.name),
  slug: t.slug || (t.url || '').split('/').filter(Boolean).pop(),
  url: t.url,
  cats: categories(t.category),
  category: decode(t.category),
  duration: decode(t.duration),
  days: days(t.duration),
  season: season(t.short_description),
  start_from: decode(t.start_from),
  tour_speed: decode(t.tour_speed),
  accommodations: decode(t.accommodations),
  activities: decode(t.activities),
  total_drive: decode(t.total_drive),
  summary: cleanSummary(t.short_description),
  highlights: whyLove(t.full_description),
  itinerary: parseItinerary(t.full_description, days(t.duration)),
  images: (t.images || []).filter(Boolean)
})).sort((a, b) => b.days - a.days);

fs.writeFileSync(OUT, 'window.TOURS = ' + JSON.stringify(tours) + ';\n');
console.log(`Wrote ${tours.length} tours to tours-data.js (${(fs.statSync(OUT).size/1024).toFixed(0)} KB)`);
console.log('Sample:', tours[0].name, '| days', tours[0].days, '| itinerary', tours[0].itinerary.length, '| imgs', tours[0].images.length, '| highlights', tours[0].highlights.length);
