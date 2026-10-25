// Backups of the live content: content/*.json (tours, posts, reviews, leads, chats, site
// settings...) and, when asked, the bot's photo uploads in public/images/. The server is the
// only place this content exists, so the admin bot sends the archive to the owner's Telegram
// once a day (bot.js); scripts/restore-backup.js puts it back.
//
// Format: a plain .tar.gz (opens with 7-Zip, macOS Archive Utility, `tar -xzf`), written here
// without any dependency.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TELEGRAM_LIMIT = 49 * 1024 * 1024;   // bots may send documents up to 50 MB

// ---------- minimal ustar writer / reader ----------
function header(name, size, mtime) {
  const h = Buffer.alloc(512, 0);
  let prefix = '', base = name;
  if (Buffer.byteLength(name) > 100) {                // ustar: split long paths at a slash into prefix/name
    const cut = name.lastIndexOf('/', 155);
    if (cut <= 0 || Buffer.byteLength(name.slice(cut + 1)) > 100) throw new Error('path too long for the archive: ' + name);
    prefix = name.slice(0, cut); base = name.slice(cut + 1);
  }
  const put = (str, off, len) => h.write(str, off, len, 'utf8');
  const oct = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0';
  put(base, 0, 100);
  put(oct(0o644, 8), 100, 8);
  put(oct(0, 8), 108, 8); put(oct(0, 8), 116, 8);
  put(oct(size, 12), 124, 12);
  put(oct(Math.floor(mtime / 1000), 12), 136, 12);
  put('        ', 148, 8);                                 // checksum is computed with spaces here
  put('0', 156, 1);                                        // regular file
  put('ustar\0', 257, 6); put('00', 263, 2);
  put(prefix, 345, 155);
  let sum = 0; for (const byte of h) sum += byte;
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return h;
}
function tar(entries) {               // entries: [{ name, data: Buffer, mtime }]
  const parts = [];
  for (const e of entries) {
    parts.push(header(e.name, e.data.length, e.mtime || Date.now()), e.data);
    const pad = (512 - (e.data.length % 512)) % 512;
    if (pad) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(1024, 0));  // two zero blocks end the archive
  return Buffer.concat(parts);
}
function untar(buf) {
  const out = [];
  for (let off = 0; off + 512 <= buf.length;) {
    const h = buf.subarray(off, off + 512);
    if (h.every(byte => byte === 0)) break;
    const str = (s, l) => h.toString('utf8', s, s + l).replace(/\0.*$/s, '');
    const size = parseInt(str(124, 12).trim() || '0', 8);
    const prefix = str(345, 155), name = str(0, 100);
    const type = str(156, 1) || '0';
    off += 512;
    if (type === '0') out.push({ name: prefix ? prefix + '/' + name : name, data: buf.subarray(off, off + size) });
    off += Math.ceil(size / 512) * 512;
  }
  return out;
}

// ---------- what goes in ----------
// root: the project folder. Content: every top-level file in content/ (JSON data and the
// migration log), not the before-* snapshots. Images: everything under public/images/.
function collect(root, { images = false } = {}) {
  const files = [];
  const contentDir = path.join(root, 'content');
  if (fs.existsSync(contentDir)) for (const f of fs.readdirSync(contentDir)) {
    const p = path.join(contentDir, f);
    if (fs.statSync(p).isFile() && !/\.(bak|tmp)$/.test(f)) files.push('content/' + f);
  }
  if (images) {
    const walk = rel => {
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs)) return;
      for (const f of fs.readdirSync(abs)) {
        const r = rel + '/' + f, st = fs.statSync(path.join(root, r));
        if (st.isDirectory()) walk(r); else if (!/\.(tmp)$/.test(f)) files.push(r);
      }
    };
    walk('public/images');
  }
  return files;
}

// Builds the archive. Resolves to { buffer, name, files, bytes, tooBig }. Compression runs in the
// thread pool: the site shares the process with the bot and keeps answering meanwhile.
async function makeArchive(root, { images = false, date = new Date() } = {}) {
  const files = collect(root, { images });
  const entries = files.map(rel => { const abs = path.join(root, rel); return { name: rel, data: fs.readFileSync(abs), mtime: fs.statSync(abs).mtimeMs }; });
  // photos are already compressed, so a light level is as small and much faster
  const buffer = await new Promise((resolve, reject) => zlib.gzip(tar(entries), { level: images ? 1 : 9 }, (e, b) => e ? reject(e) : resolve(b)));
  const stamp = date.toISOString().slice(0, 10);
  return { buffer, name: `azat-${images ? 'full' : 'content'}-backup-${stamp}.tar.gz`, files: files.length, bytes: buffer.length, tooBig: buffer.length > TELEGRAM_LIMIT };
}

// Only these places may be written back by a restore.
const RESTORABLE = /^(content\/[^/]+|public\/images\/[a-z0-9._/-]+)$/i;
function readArchive(buffer) {
  const entries = untar(zlib.gunzipSync(buffer));
  for (const e of entries) if (!RESTORABLE.test(e.name) || e.name.split('/').includes('..')) throw new Error('unexpected path in the archive: ' + e.name);
  return entries;
}

// Bishkek time (UTC+6, no daylight saving): the hour and the calendar day for the schedule.
function bishkekNow(d = new Date()) {
  const t = new Date(d.getTime() + 6 * 3600 * 1000);
  return { hour: t.getUTCHours(), day: t.toISOString().slice(0, 10), weekday: t.getUTCDay() };
}

// Daily schedule: one backup per Bishkek day, in the given hour (10:00 Bishkek = night in Europe
// and America, the quietest hour for this site); photos go along on Sundays.
// state = { lastDay } from content/.backup-state.json. Returns null when nothing is due.
function due(state, date = new Date(), hour = 10) {
  const now = bishkekNow(date);
  if (now.hour !== hour || (state && state.lastDay === now.day)) return null;
  return { day: now.day, images: now.weekday === 0 };
}

module.exports = { makeArchive, readArchive, collect, tar, untar, bishkekNow, due, TELEGRAM_LIMIT };
