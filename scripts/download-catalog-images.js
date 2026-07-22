#!/usr/bin/env node
/**
 * Downloads the catalog photos (tour galleries + sights) from kyrgyzriders.com
 * and self-hosts them under public/img/catalog/. One-off; the output lands in
 * git and ships with the code. Owner confirmed kyrgyzriders gave permission
 * (2026-07-22), so self-hosting these exact frames is licensed.
 *
 * Deterministic naming: img/catalog/<sha1(url)[:16]>.jpg — dedupes URLs shared
 * across tours/sights and makes the run resumable (existing files are skipped).
 * Pair with localize-catalog-images.js, which rewrites content/*.json to the
 * same local paths.
 *
 *   node scripts/download-catalog-images.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'img', 'catalog');
const MAXW = 1600;
const CONCURRENCY = 6;

const localName = url => crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.jpg';

function collectUrls() {
  const set = new Set();
  const tours = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tours.json'), 'utf8'));
  tours.forEach(t => (t.images || []).forEach(u => { if (/kyrgyzriders\.com/.test(u)) set.add(u); }));
  try {
    const sights = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'sights.json'), 'utf8'));
    Object.values(sights).forEach(s => { if (s.photo && /kyrgyzriders\.com/.test(s.photo)) set.add(s.photo); });
  } catch (e) { /* sights optional */ }
  return [...set];
}

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 AzatToursBot' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 4) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return resolve(fetchBuffer(next, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function fetchWithRetry(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fetchBuffer(url); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, 400 * (i + 1))); }
  }
  throw last;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const urls = collectUrls();
  console.log(`Found ${urls.length} unique kyrgyzriders image URLs.`);

  let done = 0, skipped = 0, failed = [];
  let idx = 0;

  async function worker() {
    while (idx < urls.length) {
      const url = urls[idx++];
      const dest = path.join(OUT_DIR, localName(url));
      if (fs.existsSync(dest)) { skipped++; continue; }
      try {
        const buf = await fetchWithRetry(url);
        await sharp(buf).rotate().resize({ width: MAXW, withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true }).toFile(dest);
        done++;
        if ((done + skipped) % 25 === 0) console.log(`  ...${done + skipped}/${urls.length}`);
      } catch (e) {
        failed.push({ url, error: String(e.message || e) });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nDownloaded ${done}, skipped ${skipped} (already present), failed ${failed.length}.`);
  if (failed.length) {
    const fp = path.join(__dirname, '_catalog-download-failures.json');
    fs.writeFileSync(fp, JSON.stringify(failed, null, 2));
    console.log('Failures written to ' + fp);
    failed.slice(0, 10).forEach(f => console.log('  FAIL', f.error, f.url));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
