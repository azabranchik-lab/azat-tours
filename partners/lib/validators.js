// Pure input validators/normalizers (SPEC §6, §8). Each returns
// { ok: true, value } or { ok: false } so handlers can re-ask the same question.

const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

function text(input, min, max) {
  const v = clean(input);
  return v.length >= min && v.length <= max ? { ok: true, value: v } : { ok: false };
}

// Kyrgyz numbers become +996XXXXXXXXX; anything that starts with + (or 00) and
// has 8-15 digits is kept as an international number.
function phone(input) {
  const raw = String(input == null ? '' : input).trim();
  if (!/^[+\d\s()\-.]+$/.test(raw)) return { ok: false };
  let d = raw.replace(/\D/g, '');
  const intl = raw.startsWith('+') || d.startsWith('00');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('996') && d.length === 12) return { ok: true, value: '+' + d };
  if (!intl && d.length === 10 && d.startsWith('0')) return { ok: true, value: '+996' + d.slice(1) };
  if (!intl && d.length === 9) return { ok: true, value: '+996' + d };
  if (intl && d.length >= 8 && d.length <= 15) return { ok: true, value: '+' + d };
  // Telegram contacts can arrive without the leading +.
  if (d.length >= 11 && d.length <= 15 && !d.startsWith('0')) return { ok: true, value: '+' + d };
  return { ok: false };
}

const name = input => text(input, 2, 100);
const city = input => text(input, 2, 60);

module.exports = { clean, text, phone, name, city };
