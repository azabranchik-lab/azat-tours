// The add-car wizard as data (SPEC §6.3) plus pure navigation/parsing functions.
// Handlers only render questions and store answers; every decision about which
// step comes next lives here, so it is unit-tested without Telegram.

const MAKES = ['Toyota', 'Lexus', 'Honda', 'Hyundai', 'Kia', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Subaru'];
const SEATS = [2, 4, 5, 7, 8];
const MIN_DAYS = [1, 2, 3];
const AVAIL_PRESETS = ['avail_year', 'avail_summer']; // i18n keys; the label text is what gets stored

const { CITIES } = require('../menus');

const hasMode = (car, mode) => Array.isArray(car.rentalModes) && car.rentalModes.includes(mode);
const isSelfDriveOnly = car => Array.isArray(car.rentalModes) && car.rentalModes.length === 1 && car.rentalModes[0] === 'SELF_DRIVE';

// type:
//   enum   – one of `options` (buttons only); `toValue` maps the option to the stored value
//   multi  – several of `options` (toggle buttons + «Готово»)
//   text   – free text, `min`..`max` chars; `presets` are i18n keys shown as buttons, `other` prompts for text
//   int    – whole number `min`..`max`; `presets` are numbers shown as buttons
//   title  – make, model and year typed in one line (parseTitle)
//   group  – several button fields of `fields` on one screen, then «Готово»
//   photos – photo upload step (not a car column)
// title and group steps have no column of their own: they fill `fields`, which
// stay separate steps (inWizard: false) for the card and for «Изменить».
// inWizard: false – not asked by the wizard, editable from the summary.
// editable: false – not offered in the summary's «Изменить» either.
// groupLabels – inside a group the buttons say which question they answer (g_* keys in i18n).
// skipValue – what «Пропустить» stores (default null, [] for multi).
const STEPS = [
  { key: 'title', type: 'title', fields: ['make', 'model', 'year'] },
  { key: 'make', type: 'text', min: 2, max: 40, required: true, presets: MAKES, presetsRaw: true, other: 'make_other', inWizard: false },
  { key: 'model', type: 'text', min: 1, max: 60, required: true, inWizard: false },
  { key: 'year', type: 'int', min: 1990, max: () => new Date().getFullYear() + 1, required: true, inWizard: false },
  { key: 'specs', type: 'group', fields: ['bodyType', 'transmission', 'drive', 'fuel', 'seats'] },
  { key: 'bodyType', type: 'enum', required: true, inWizard: false, options: ['SEDAN', 'SUV', 'CROSSOVER', 'MINIVAN', 'MINIBUS', 'PICKUP', 'OTHER'] },
  { key: 'transmission', type: 'enum', required: true, inWizard: false, options: ['AUTOMATIC', 'MANUAL'] },
  { key: 'drive', type: 'enum', required: true, inWizard: false, perRow: 3, options: ['AWD', 'FWD', 'RWD'] },
  { key: 'fuel', type: 'enum', required: true, inWizard: false, perRow: 3, options: ['PETROL', 'DIESEL', 'GAS_PETROL', 'HYBRID', 'ELECTRIC'] },
  { key: 'seats', type: 'int', min: 1, max: 30, required: true, presets: SEATS, inWizard: false },
  // Color and mileage are visible on the photos (mileage on the dashboard shot): not asked since 2026-10-17 (owner).
  { key: 'color', type: 'text', min: 2, max: 30, required: false, inWizard: false },
  // Not asked since 2026-10-18 (owner): we read the plate from the photos, so partners must not hide it there.
  { key: 'plateNumber', type: 'text', min: 4, max: 12, required: false, inWizard: false, normalize: s => s.toUpperCase() },
  { key: 'mileageKm', type: 'int', min: 0, max: 2000000, required: false, inWizard: false },
  // Equipment and description now go into the one comment step (restrictions), 2026-10-18 (owner).
  { key: 'features', type: 'multi', required: false, inWizard: false, editable: false, options: ['AC', 'SEAT_HEATING', 'REAR_CAMERA', 'NAVIGATION', 'CHILD_SEAT', 'ROOF_RACK', 'WINTER_TIRES'] },
  { key: 'description', type: 'text', min: 20, max: 1500, required: false, inWizard: false, editable: false },
  // Every car is self-drive (2026-10-18, owner): a traveller who needs a driver writes to us.
  // New drafts start with ['SELF_DRIVE'] (handlers.js); the field stays for older cars.
  { key: 'rentalModes', type: 'enum', required: true, inWizard: false, editable: false, perRow: 1, options: ['SELF_DRIVE', 'WITH_DRIVER', 'BOTH'],
    toValue: o => (o === 'BOTH' ? ['SELF_DRIVE', 'WITH_DRIVER'] : [o]) },
  { key: 'priceSelfDrive', type: 'int', min: 1, max: 1000000, required: true, when: car => hasMode(car, 'SELF_DRIVE') },
  { key: 'priceWithDriver', type: 'int', min: 1, max: 1000000, required: true, inWizard: false, editable: false, when: car => hasMode(car, 'WITH_DRIVER') },
  // «Пропустить» means no deposit.
  { key: 'deposit', type: 'int', min: 0, max: 10000000, required: false, skipValue: 0 },
  { key: 'insDelivery', type: 'group', fields: ['insurance', 'delivery', 'minRentalDays'] },
  { key: 'insurance', type: 'enum', required: true, inWizard: false, groupLabels: true, perRow: 1, options: ['OSAGO', 'KASKO', 'NONE'] },
  { key: 'delivery', type: 'enum', required: true, inWizard: false, groupLabels: true, perRow: 1, options: ['FREE', 'PAID', 'NO'] },
  { key: 'minRentalDays', type: 'int', min: 1, max: 30, required: true, presets: MIN_DAYS, inWizard: false, groupLabels: true },
  // «Комментарий», the last question: rules, equipment, description, anything else in one answer (2026-10-18).
  { key: 'restrictions', type: 'text', min: 1, max: 1500, required: false },
  // A new car starts as «Круглый год»; the partner can change it in the summary (2026-10-17).
  { key: 'availabilityNote', type: 'text', min: 1, max: 100, required: true, presets: AVAIL_PRESETS, other: 'avail_other', inWizard: false },
  // 4 to 6 photos with the plate visible (we hide it on the site only if the partner asks, 2026-10-18),
  // the first is the cover; handled by photos.js, minimum checked via lib/photos.
  { key: 'photos', type: 'photos', required: true },
  // Not asked by the wizard (copied from the profile), but editable from the summary.
  { key: 'city', type: 'text', min: 2, max: 60, required: true, presets: CITIES, presetsRaw: true, inWizard: false }
];

const isCompound = s => Array.isArray(s.fields);
const PARENT = {};
for (const s of STEPS) if (isCompound(s)) for (const f of s.fields) PARENT[f] = s.key;

const BY_KEY = Object.fromEntries(STEPS.map((s, i) => [s.key, { ...s, index: i, parent: PARENT[s.key] || null }]));
// Copying a car re-asks only what differs between two cars of the same model.
const COPY_STEPS = ['photos'];
const COPY_EXCLUDED = ['color', 'plateNumber', 'mileageKm'];

const step = key => BY_KEY[key] || null;
const stepByIndex = i => (STEPS[i] ? BY_KEY[STEPS[i].key] : null);
const applies = (s, car) => !s.when || s.when(car);
const maxOf = s => (typeof s.max === 'function' ? s.max() : s.max);
const isEmpty = v => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
// Steps that hold a value of their own (shown in the card and in «Изменить»).
const FIELD_STEPS = STEPS.filter(s => !isCompound(s) && s.type !== 'photos');

function sequence(mode) {
  return mode === 'copy' ? COPY_STEPS : STEPS.filter(s => s.inWizard !== false).map(s => s.key);
}

// Next applicable step after `current` in this mode; 'summary' when done.
// In edit mode one field is changed, then back to the summary (or to a
// required field that the edit made necessary, see missingRequired).
function nextStep(car, current, mode = 'full') {
  if (mode === 'edit') return 'summary';
  const seq = sequence(mode);
  for (let i = seq.indexOf(current) + 1; i < seq.length; i++) {
    if (applies(BY_KEY[seq[i]], car)) return seq[i];
  }
  return 'summary';
}

// Previous applicable step, or null on the first one (no «Назад» button).
function prevStep(car, current, mode = 'full') {
  if (mode === 'edit') return null;
  const seq = sequence(mode);
  for (let i = seq.indexOf(current) - 1; i >= 0; i--) {
    if (applies(BY_KEY[seq[i]], car)) return seq[i];
  }
  return null;
}

function missingRequired(car) {
  return FIELD_STEPS.filter(s => s.required && applies(s, car) && isEmpty(car[s.key])).map(s => s.key);
}

// Fields that no longer apply (e.g. self-drive price after SELF_DRIVE was
// removed) are cleared so they never reach the site.
function inapplicableFields(car) {
  const out = {};
  for (const s of FIELD_STEPS) if (!applies(s, car) && !isEmpty(car[s.key])) out[s.key] = null;
  return out;
}

function parseNumber(s, raw) {
  const cleaned = raw.replace(/[\s ]/g, '').replace(/(сом|сомов|som|km|км)\.?$/i, '');
  const max = maxOf(s);
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: 'bad_number', params: { min: s.min, max } };
  const n = Number(cleaned);
  if (n < s.min || n > max) return { ok: false, error: 'bad_number', params: { min: s.min, max } };
  return { ok: true, value: n };
}

// Makes recognised in «марка модель год»; aliases are typed spellings of a listed make.
const KNOWN_MAKES = [
  ...MAKES, 'Land Rover', 'Range Rover', 'Mazda', 'Volkswagen', 'Chevrolet', 'Daewoo', 'Ravon', 'Lada', 'BMW', 'Audi',
  'Ford', 'Infiniti', 'Suzuki', 'Isuzu', 'Skoda', 'Volvo', 'Porsche', 'Jeep', 'Renault', 'Peugeot', 'Opel', 'Genesis',
  'Daihatsu', 'SsangYong', 'Chery', 'Geely', 'Haval', 'Changan', 'Jetour', 'BYD', 'Zeekr', 'Tank', 'Exeed', 'Omoda',
  'GAC', 'JAC', 'Dongfeng', 'Tesla', 'Mini', 'Jaguar', 'Cadillac', 'Dodge', 'УАЗ', 'ГАЗ'
];
const MAKE_ALIASES = {
  'mercedes benz': 'Mercedes-Benz', mercedes: 'Mercedes-Benz', 'мерседес': 'Mercedes-Benz', 'тойота': 'Toyota',
  'лексус': 'Lexus', 'хонда': 'Honda', 'хендай': 'Hyundai', 'хёндай': 'Hyundai', 'хундай': 'Hyundai', 'хюндай': 'Hyundai',
  'киа': 'Kia', 'мицубиси': 'Mitsubishi', 'митсубиси': 'Mitsubishi', 'ниссан': 'Nissan', 'субару': 'Subaru',
  'лада': 'Lada', 'мазда': 'Mazda', 'фольксваген': 'Volkswagen', 'шевроле': 'Chevrolet', 'дэу': 'Daewoo'
};
const MAKE_NAMES = [
  ...KNOWN_MAKES.map(m => [m.toLowerCase(), m]),
  ...Object.entries(MAKE_ALIASES)
].sort((a, b) => b[0].length - a[0].length); // longest first: «Land Rover» before «Land»

// «Toyota Land Cruiser 200 2019» → { make, model, year }. The year is the last
// 4-digit number in range; the make is a known one at the start, else the first word.
function parseTitle(raw) {
  const yearStep = BY_KEY.year;
  const params = { min: yearStep.min, max: maxOf(yearStep) };
  const words = raw.split(' ').filter(Boolean);
  let yi = -1;
  words.forEach((w, i) => {
    const m = w.match(/^\(?(\d{4})(г\.?)?\)?[,.]?$/i);
    if (m && Number(m[1]) >= params.min && Number(m[1]) <= params.max) yi = i;
  });
  if (yi < 0) return { ok: false, error: 'title_no_year', params };
  const year = Number(words[yi].match(/\d{4}/)[0]);
  const rest = words.filter((w, i) => i !== yi && !/^(г\.?|год[а]?)$/i.test(w))
    .join(' ').replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = rest.toLowerCase();
  let make = null;
  let model = '';
  for (const [name, canonical] of MAKE_NAMES) {
    if (lower === name || lower.startsWith(name + ' ') || lower.startsWith(name + '-')) {
      make = canonical;
      model = rest.slice(name.length).replace(/^[\s-]+/, '');
      break;
    }
  }
  if (!make) {
    const sp = rest.indexOf(' ');
    make = sp < 0 ? rest : rest.slice(0, sp);
    model = sp < 0 ? '' : rest.slice(sp + 1);
  }
  if (!model || make.length < BY_KEY.make.min) return { ok: false, error: 'title_no_model' };
  if (make.length > BY_KEY.make.max || model.length > BY_KEY.model.max) return { ok: false, error: 'title_too_long' };
  return { ok: true, value: { make, model, year } };
}

// Parse a typed answer. Returns { ok: true, value } or { ok: false, error, params }.
// title: value is { make, model, year }; group: only its number field (seats) can
// be typed, value is { seats: n }.
function parseText(s, input) {
  const raw = String(input == null ? '' : input).replace(/\s+/g, ' ').trim();
  if (s.type === 'photos') return { ok: false, error: 'send_photo' };
  if (s.type === 'title') return parseTitle(raw);
  if (s.type === 'group') {
    const f = s.fields.map(k => BY_KEY[k]).find(x => x.type === 'int');
    if (!f || !/\d/.test(raw)) return { ok: false, error: 'choose_button' };
    const r = parseNumber(f, raw);
    return r.ok ? { ok: true, value: { [f.key]: r.value } } : r;
  }
  if (s.type === 'enum' || s.type === 'multi') return { ok: false, error: 'choose_button' };
  if (s.type === 'int') return parseNumber(s, raw);
  const value = s.normalize ? s.normalize(raw) : raw;
  if (value.length < s.min || value.length > s.max) {
    return { ok: false, error: s.min > 1 ? 'bad_text_len' : 'bad_text_max', params: { min: s.min, max: s.max } };
  }
  return { ok: true, value };
}

// Fields of a group step still without a value.
function groupMissing(s, car) {
  return s.fields.filter(k => isEmpty(car[k]));
}

// A fresh draft copied from an existing car (SPEC §6.3).
function copyFields(src) {
  const out = {};
  for (const s of FIELD_STEPS) if (!COPY_EXCLUDED.includes(s.key)) out[s.key] = src[s.key];
  out.city = src.city;
  out.copiedFromId = src.id;
  return out;
}

// The wizard step that asks for this field: its group/title step, itself, or
// (for a field the wizard no longer asks) the next wizard step after it.
function wizardStep(key) {
  const s = BY_KEY[key];
  if (!s) return null;
  if (s.parent) return s.parent;
  if (s.inWizard !== false) return key;
  for (let i = s.index + 1; i < STEPS.length; i++) {
    const n = BY_KEY[STEPS[i].key];
    if (n.parent) return n.parent;
    if (n.inWizard !== false) return n.key;
  }
  return 'summary';
}

// Where «Продолжить» resumes a draft. Drafts saved before 2026-10-17 may point at
// a step that is now part of a group or no longer asked.
function resumeStep(car) {
  if (car.draftStep === 'summary') return 'summary';
  // An old copy draft stopped at color, mileage or the plate: a copy now asks only the photos.
  if (car.copiedFromId && ['color', 'mileageKm', 'plateNumber'].includes(car.draftStep)) return 'photos';
  const saved = car.draftStep && wizardStep(car.draftStep);
  if (saved) return saved;
  const miss = missingRequired(car)[0];
  return miss ? wizardStep(miss) : 'summary';
}

module.exports = {
  STEPS, FIELD_STEPS, COPY_STEPS, MAKES, SEATS, MIN_DAYS, AVAIL_PRESETS,
  step, stepByIndex, applies, maxOf, sequence, nextStep, prevStep, isCompound, groupMissing, wizardStep,
  missingRequired, inapplicableFields, isSelfDriveOnly, parseText, parseTitle, copyFields, resumeStep, isEmpty
};
