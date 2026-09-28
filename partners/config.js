// Reads the `partners` block of config.json (SPEC §3). Returns null when the
// partner bot is not configured, so the site and the admin bot keep running.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function load() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')); } catch (e) {}
  const p = cfg.partners || {};
  const token = process.env.PARTNER_BOT_TOKEN || p.token || '';
  if (!token || token.includes('PASTE-')) return { ok: false, reason: 'no partners.token in config.json (partner bot not started)' };
  if (token === cfg.token) return { ok: false, reason: 'partners.token must differ from the admin bot token' };

  const ownerId = Number(process.env.OWNER_ID || cfg.ownerId) || 0;
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
    dbFile: path.join(ROOT, 'content', 'partners.db'),
    siteUrl: cfg.origin || 'https://azattours.com'
  };

  const errors = [];
  if (!adminIds.length) errors.push('ownerId is not set');
  for (const k of ['adminChatId', 'commissionPercent', 'photoMaxMb', 'minFreeDiskGb', 'rateLimitPerMin']) {
    if (!Number.isFinite(out[k])) errors.push(`partners.${k} must be a number`);
  }
  if (errors.length) return { ok: false, reason: errors.join('; ') };
  return { ok: true, config: out };
}

module.exports = { load };
