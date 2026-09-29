// Reads partners/config.json (SPEC §3). The bot is standalone: it never reads the
// website's config and never sees the admin bot's token.
// Returns { ok: false, reason } when not configured, so the problem is logged plainly.
const fs = require('fs');
const path = require('path');
const { writeFileAtomic } = require('./lib/fsx');

const ROOT = __dirname;
const CONFIG_FILE = process.env.PARTNERS_CONFIG || path.join(ROOT, 'config.json');
const DATA_DIR = process.env.PARTNERS_DATA || path.join(ROOT, 'data');

function load(file = CONFIG_FILE) {
  let p = {};
  try { p = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    return { ok: false, reason: `cannot read ${file}: ${e.message}` };
  }
  const token = process.env.PARTNER_BOT_TOKEN || p.token || '';
  if (!token || token.includes('PASTE-')) return { ok: false, reason: `no token in ${file}` };

  const ownerId = Number(process.env.OWNER_ID || p.ownerId) || 0;
  const adminIds = [ownerId, ...(Array.isArray(p.adminIds) ? p.adminIds : [])].map(Number).filter(Boolean);
  const num = (v, def) => (v === undefined || v === null || v === '' ? def : Number(v));

  const out = {
    token,
    adminIds,
    adminChatId: num(p.adminChatId, 0),
    commissionPercent: num(p.commissionPercent, 15),
    offerVersion: String(p.offerVersion || '2026-09'),
    supportWhatsapp: String(p.supportWhatsapp || '+996502888001'),
    photoMaxMb: num(p.photoMaxMb, 10),
    minFreeDiskGb: num(p.minFreeDiskGb, 3),
    // 60, not 30: tapping through the ~30-step wizard quickly already takes ~30 updates a minute.
    rateLimitPerMin: num(p.rateLimitPerMin, 60),
    dbFile: path.join(DATA_DIR, 'partners.db'),
    photosDir: path.join(DATA_DIR, 'car-photos'),
    siteUrl: String(p.siteUrl || 'https://azattours.com')
  };

  const errors = [];
  if (!ownerId) errors.push('ownerId is not set');
  for (const k of ['adminChatId', 'commissionPercent', 'photoMaxMb', 'minFreeDiskGb', 'rateLimitPerMin']) {
    if (!Number.isFinite(out[k])) errors.push(`${k} must be a number`);
  }
  if (errors.length) return { ok: false, reason: errors.join('; ') };
  return { ok: true, config: out };
}

// Persist adminChatId (set by /chatid). Re-reads the file and keeps every other key.
function saveAdminChatId(id, file = CONFIG_FILE) {
  const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
  cur.adminChatId = id;
  writeFileAtomic(file, JSON.stringify(cur, null, 2) + '\n');
}

module.exports = { load, saveAdminChatId, CONFIG_FILE, DATA_DIR };
