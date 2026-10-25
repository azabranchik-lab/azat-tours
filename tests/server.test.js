// The HTTP server end to end, on an isolated copy (tests/helpers/site.js): routes, every old
// address, 404s, path safety, caching, compression, image formats and sizes, the lead and chat
// API (no Telegram token in the copy, so nothing is sent anywhere).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { startSite } = require('./helpers/site');

let site;
test.before(async () => { site = await startSite(); });
test.after(async () => { if (site) await site.stop(); });

const get = (p, opts = {}) => fetch(site.base + p, Object.assign({ redirect: 'manual' }, opts));
const location = r => (r.headers.get('location') || '').replace('https://azattours.com', '').replace(site.base, '');
const redirects = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tour-redirects.json'), 'utf8')).renames;
const firstTourSlug = async () => (await (await get('/tours/')).text()).match(/href="\/tours\/([a-z0-9-]+)\/"/)[1];
const firstPostSlug = async () => (await (await get('/blog/')).text()).match(/href="\/blog\/([a-z0-9-]+)\/"/)[1];

test('main pages answer 200 with HTML, one H1 and a canonical to themselves', async () => {
  const tour = await firstTourSlug(), post = await firstPostSlug();
  for (const p of ['/', '/tours/', '/blog/', `/tours/${tour}/`, `/blog/${post}/`, '/about.html', '/contact.html', '/plan-trip.html']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p);
    assert.match(r.headers.get('content-type'), /text\/html/, p);
    const html = await r.text();
    assert.strictEqual((html.match(/<h1[\s>]/g) || []).length, 1, p + ': one <h1>');
    assert.ok(html.includes(`<link rel="canonical" href="https://azattours.com${p}"`), p + ': canonical');
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(html), p + ': no unfilled placeholder');
  }
});

test('old addresses: one 301 to the right page, never a chain', async () => {
  const tour = await firstTourSlug(), post = await firstPostSlug();
  const cases = [
    ['/tours', '/tours/'], ['/blog', '/blog/'], [`/tours/${tour}`, `/tours/${tour}/`], [`/blog/${post}`, `/blog/${post}/`],
    ['/tours.html', '/tours/'], ['/blog.html', '/blog/'], ['/index.html', '/'], ['/tour.html', '/tours/'], ['/post.html', '/blog/'],
    [`/tour.html?slug=${tour}`, `/tours/${tour}/`], [`/post.html?slug=${post}`, `/blog/${post}/`], ['/tours.html?cat=Road%20trip', '/tours/?cat=Road%20trip'],
  ];
  for (const old of Object.keys(redirects)) {
    const r1 = await get('/tour.html?slug=' + old), r2 = await get('/tours/' + old + '/');
    for (const r of [r1, r2]) {
      assert.strictEqual(r.status, 301, old);
      const to = location(r);
      const final = await get(to);
      assert.strictEqual(final.status, 200, old + ' -> ' + to + ' must be final (no chain)');
    }
  }
  for (const [from, to] of cases) {
    const r = await get(from);
    assert.strictEqual(r.status, 301, from);
    assert.strictEqual(location(r), to, from);
  }
  // fetch() ignores a custom Host header, so the www check uses a raw request
  const www = await new Promise((resolve, reject) => {
    const u = new URL(site.base);
    require('http').get({ host: u.hostname, port: u.port, path: '/tours/', headers: { host: 'www.azattours.com' } }, res => { res.resume(); resolve(res); }).on('error', reject);
  });
  assert.strictEqual(www.statusCode, 301);
  assert.strictEqual(www.headers.location, 'https://azattours.com/tours/');
});

test('unknown pages are a real 404 with the branded page, not a redirect to the catalog', async () => {
  for (const p of ['/tours/does-not-exist/', '/tour.html?slug=does-not-exist', '/post.html?slug=does-not-exist', '/blog/nope/', '/nope.html', '/tours//', '/cars/']) {
    const r = await get(p);
    assert.strictEqual(r.status, 404, p);
    assert.match(await r.text(), /<header id="header"/, p + ': branded 404 with navigation');
  }
});

test('path safety: no config, no source, no working copies, no hidden files, bad URLs rejected', async () => {
  for (const p of ['/../config.json', '/%2e%2e/config.json', '/..%2fserver.js', '/tours-data.js.bak', '/posts-data.js.bak', '/.git/config', '/content/leads.json', '/lib/pages.js']) {
    const r = await get(p);
    assert.ok([400, 403, 404].includes(r.status), p + ' answered ' + r.status);
  }
  assert.strictEqual((await get('/%E0%A4%A')).status, 400, 'malformed escape');
});

test('caching: HTML revalidates, versioned CSS/JS and fonts for a year, images a week; ETag gives 304', async () => {
  const home = await get('/');
  assert.strictEqual(home.headers.get('cache-control'), 'no-cache');
  const html = await home.text();
  const css = html.match(/href="(\/styles\.css\?v=[a-z0-9]+)"/)[1];
  assert.match((await get(css)).headers.get('cache-control'), /max-age=31536000, immutable/);
  assert.strictEqual((await get('/styles.css')).headers.get('cache-control'), 'no-cache', 'unversioned stays no-cache');
  const font = await get('/fonts/figtree-latin.woff2');
  assert.strictEqual(font.headers.get('content-type'), 'font/woff2');
  assert.match(font.headers.get('cache-control'), /31536000/);
  const img = html.match(/src="(\/img\/[^"?]+\.jpg)"/)[1];
  const ir = await get(img);
  assert.match(ir.headers.get('cache-control'), /max-age=604800/);
  assert.strictEqual(ir.headers.get('vary'), 'Accept');
  const etag = home.headers.get('etag');
  assert.ok(etag);
  assert.strictEqual((await get('/', { headers: { 'if-none-match': etag } })).status, 304);
});

test('compression: gzip when the browser accepts it', async () => {
  const r = await get('/tours/', { headers: { 'accept-encoding': 'gzip' } });
  assert.strictEqual(r.headers.get('content-encoding'), 'gzip');
});

test('images: AVIF or WebP by Accept, JPEG otherwise; ?w= resizes, odd widths fall back to the original', async () => {
  const html = await (await get('/tours/')).text();
  const img = html.match(/src="(\/img\/catalog\/[^"?]+\.jpg)"/)[1];
  assert.strictEqual((await get(img, { headers: { accept: 'image/avif,image/webp,*/*' } })).headers.get('content-type'), 'image/avif');
  assert.strictEqual((await get(img, { headers: { accept: 'image/webp,*/*' } })).headers.get('content-type'), 'image/webp');
  assert.strictEqual((await get(img, { headers: { accept: '*/*' } })).headers.get('content-type'), 'image/jpeg');
  const full = (await (await get(img, { headers: { accept: 'image/avif' } })).arrayBuffer()).byteLength;
  const small = await get(img + '?w=480', { headers: { accept: 'image/avif' } });
  assert.strictEqual(small.status, 200);
  assert.ok((await small.arrayBuffer()).byteLength < full, '480 px copy is lighter than the original');
  assert.strictEqual((await get(img + '?w=777', { headers: { accept: '*/*' } })).status, 200, 'unlisted width: original');
  assert.strictEqual((await get('/img/catalog/missing.jpg?w=480')).status, 404);
});

test('sitemap, robots and plain-text versions', async () => {
  const sm = await get('/sitemap.xml');
  assert.match(sm.headers.get('content-type'), /xml/);
  const xml = await sm.text();
  assert.ok(!/changefreq|priority/.test(xml));
  assert.ok(!/\.html\?|tour\.html|post\.html/.test(xml), 'no old-style URLs');
  assert.ok((xml.match(/<loc>/g) || []).length > 20);
  assert.match(await (await get('/robots.txt')).text(), /Sitemap: https:\/\/azattours\.com\/sitemap\.xml/);
  const llms = await get('/llms.txt');
  assert.strictEqual(llms.status, 200);
  assert.match(await llms.text(), /^# Azat Tours/);
  const md = await get('/tours/' + (await firstTourSlug()) + '.md');
  assert.strictEqual(md.status, 200);
  assert.strictEqual(md.headers.get('x-robots-tag'), 'noindex', 'Markdown copies stay out of the index');
  const reviews = await (await get('/reviews.html')).text();
  assert.match(reviews, /noindex/, 'reviews page stays noindex without reviews');
});

test('lead API: validation, honeypot, size cap, rate limit; a valid enquiry is stored', async () => {
  const post = body => get('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  assert.strictEqual((await post({ name: 'TEST', email: 'not-an-email' })).status, 400);
  const bot = await post({ name: 'TEST bot', email: 'bot@example.com', botcheck: 'on' });
  assert.strictEqual(bot.status, 200, 'honeypot answers ok');
  const big = await post({ name: 'TEST', email: 'a@example.com', msg: 'x'.repeat(25000) });
  assert.strictEqual(big.status, 413);
  const ok = await post({ tour: 'TEST tour', name: 'TEST Traveller', email: 'test@example.com', people: '2', dates: 'July', msg: 'TEST message', extra: 'dropped' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual((await ok.json()).ok, true);
  const leads = JSON.parse(fs.readFileSync(path.join(site.root, 'content', 'leads.json'), 'utf8'));
  assert.strictEqual(leads.length, 1, 'only the valid enquiry is stored (not the honeypot one)');
  assert.strictEqual(leads[0].email, 'test@example.com');
  assert.ok(!('extra' in leads[0]), 'unknown fields are dropped');
  let status = 0;
  for (let i = 0; i < 6 && status !== 429; i++) status = (await post({ name: 'TEST', email: 'rate@example.com' })).status;
  assert.strictEqual(status, 429, 'more than 5 enquiries in 10 minutes from one address are refused');
  assert.strictEqual((await get('/api/nope')).status, 404);
});

test('chat API: a message is stored and read back; empty messages refused', async () => {
  const send = body => get('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.strictEqual((await send({ sid: 'test-sid', text: '' })).status, 400);
  assert.strictEqual((await send({ sid: 'test-sid', text: 'TEST hello', page: '/tours/' })).status, 200);
  const r = await get('/api/chat?sid=test-sid');
  const j = await r.json();
  assert.strictEqual(j.messages.length, 1);
  assert.strictEqual(j.messages[0].text, 'TEST hello');
  assert.deepStrictEqual((await (await get('/api/chat?sid=someone-else')).json()).messages, []);
});

test('the full site check (every sitemap URL, every internal link and asset) passes on this copy', async () => {
  const { execFile } = require('child_process');
  const out = await new Promise(resolve => execFile(process.execPath, [path.join(__dirname, '..', 'scripts', 'check-site.js'), site.base], { timeout: 240000 }, (err, stdout, stderr) => resolve({ code: err ? err.code : 0, text: stdout + stderr })));
  assert.strictEqual(out.code, 0, out.text.slice(-3000));
  assert.match(out.text, /All good/);
});
