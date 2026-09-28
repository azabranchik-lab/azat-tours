// Human-readable car card and field values (SPEC §6.5). Plain text only
// (no parse_mode), so partner-typed values can never break the message.
const { STEPS } = require('../bot/carWizard/steps');

function carTitle(car, t) {
  const s = [car.make, car.model, car.year].filter(v => v !== null && v !== undefined && v !== '').join(' ');
  return s || t('new_car');
}

const num = n => Number(n).toLocaleString('ru-RU');

function fieldValue(car, key, t) {
  const v = car[key];
  const s = STEPS.find(x => x.key === key);
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return t('not_set');
  if (s && (s.type === 'enum')) return t('enum_' + v);
  if (s && s.type === 'multi') return v.map(x => t('enum_' + x)).join(', ');
  if (key === 'mileageKm') return t('km', { n: num(v) });
  if (key === 'deposit') return v === 0 ? t('deposit_none') : num(v);
  if (key === 'priceSelfDrive' || key === 'priceWithDriver') return num(v);
  return String(v);
}

// Every field that applies to this car, description last (it is the longest).
function carCard(car, t) {
  const lines = [carTitle(car, t), ''];
  for (const s of STEPS) {
    if (s.key === 'description' || (s.when && !s.when(car))) continue;
    lines.push(`${t('f_' + s.key)}: ${fieldValue(car, s.key, t)}`);
  }
  lines.push('', `${t('f_description')}:`, fieldValue(car, 'description', t));
  return lines.join('\n');
}

module.exports = { carTitle, carCard, fieldValue };
