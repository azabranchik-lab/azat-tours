// The add-car wizard as data (SPEC §6.3) plus pure navigation/parsing functions.
// Handlers only render questions and store answers; every decision about which
// step comes next lives here, so it is unit-tested without Telegram.

const MAKES = ['Toyota', 'Lexus', 'Honda', 'Hyundai', 'Kia', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Subaru'];
const SEATS = [2, 4, 5, 7, 8];
const AVAIL_PRESETS = ['avail_year', 'avail_summer']; // i18n keys; the label text is what gets stored

const { CITIES } = require('../menus');

const hasMode =(car, mode) => Array.isArray(car.rentalModes) && car.rentalModes.includes(mode);

// type:
//   enum   – one of `options` (buttons only)
//   multi  – several of `options` (toggle buttons + «Готово»)
//   text   – free text, `min`..`max` chars; `presets` are i18n keys shown as buttons, `other` prompts for text
//   int    – whole number `min`..`max`; `presets` are numbers shown as buttons
//   photos – photo upload step (not a car column)
const STEPS = [
  { key: 'make', type: 'text', min: 2, max: 40, required: true, presets: MAKES, presetsRaw: true, other: 'make_other' },
  { key: 'model', type: 'text', min: 1, max: 60, required: true },
  { key: 'year', type: 'int', min: 1990, max: () => new Date().getFullYear() + 1, required: true },
  { key: 'bodyType', type: 'enum', required: true, options: ['SEDAN', 'SUV', 'CROSSOVER', 'MINIVAN', 'MINIBUS', 'PICKUP', 'OTHER'] },
  { key: 'transmission', type: 'enum', required: true, options: ['AUTOMATIC', 'MANUAL'] },
  { key: 'drive', type: 'enum', required: true, options: ['AWD', 'FWD', 'RWD'] },
  { key: 'fuel', type: 'enum', required: true, options: ['PETROL', 'DIESEL', 'GAS_PETROL', 'HYBRID', 'ELECTRIC'] },
  { key: 'seats', type: 'int', min: 1, max: 30, required: true, presets: SEATS },
  { key: 'color', type: 'text', min: 2, max: 30, required: true },
  { key: 'plateNumber', type: 'text', min: 4, max: 12, required: true, normalize: s => s.toUpperCase() },
  { key: 'mileageKm', type: 'int', min: 0, max: 2000000, required: false },
  { key: 'features', type: 'multi', required: false, options: ['AC', 'SEAT_HEATING', 'REAR_CAMERA', 'NAVIGATION', 'CHILD_SEAT', 'ROOF_RACK', 'WINTER_TIRES'] },
  { key: 'description', type: 'text', min: 20, max: 1500, required: true },
  { key: 'rentalModes', type: 'multi', required: true, options: ['SELF_DRIVE', 'WITH_DRIVER'] },
  { key: 'priceSelfDrive', type: 'int', min: 1, max: 1000000, required: true, when: car => hasMode(car, 'SELF_DRIVE') },
  { key: 'priceWithDriver', type: 'int', min: 1, max: 1000000, required: true, when: car => hasMode(car, 'WITH_DRIVER') },
  { key: 'longTermDiscount', type: 'text', min: 1, max: 200, required: false },
  { key: 'deposit', type: 'int', min: 0, max: 10000000, required: false },
  { key: 'insurance', type: 'enum', required: true, options: ['OSAGO', 'KASKO', 'NONE'] },
  { key: 'delivery', type: 'enum', required: true, options: ['FREE', 'PAID', 'NO'] },
  { key: 'driverRequirements', type: 'text', min: 1, max: 200, required: false, when: car => hasMode(car, 'SELF_DRIVE') },
  { key: 'restrictions', type: 'text', min: 1, max: 500, required: false },
  { key: 'availabilityNote', type: 'text', min: 1, max: 100, required: true, presets: AVAIL_PRESETS, other: 'avail_other' },
  { key: 'plateOnPhotos', type: 'enum', required: true, options: ['HIDE', 'BLUR', 'SHOW'] },
  // 8 required angles + up to 5 extras; handled by photos.js, completeness checked via lib/photos.
  { key: 'photos', type: 'photos', required: true },
  // Not asked by the wizard (copied from the profile), but editable from the summary.
  { key: 'city', type: 'text', min: 2, max: 60, required: true, presets: CITIES, presetsRaw: true, inWizard: false }
];

const BY_KEY = Object.fromEntries(STEPS.map((s, i) => [s.key, { ...s, index: i }]));
// Copying a car re-asks only what differs between two cars of the same model.
const COPY_STEPS = ['color', 'plateNumber', 'mileageKm', 'photos'];
const COPY_EXCLUDED = ['color', 'plateNumber', 'mileageKm'];

const step = key => BY_KEY[key] || null;
const stepByIndex = i => (STEPS[i] ? BY_KEY[STEPS[i].key] : null);
const applies = (s, car) => !s.when || s.when(car);
const maxOf = s => (typeof s.max === 'function' ? s.max() : s.max);

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

const isEmpty = v => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

function missingRequired(car) {
  return STEPS.filter(s => s.required && s.type !== 'photos' && applies(s, car) && isEmpty(car[s.key])).map(s => s.key);
}

// Fields that no longer apply (e.g. self-drive price after SELF_DRIVE was
// removed) are cleared so they never reach the site.
function inapplicableFields(car) {
  const out = {};
  for (const s of STEPS) if (s.type !== 'photos' && !applies(s, car) && !isEmpty(car[s.key])) out[s.key] = null;
  return out;
}

// Parse a typed answer. Returns { ok: true, value } or { ok: false, error, params }.
function parseText(s, input) {
  const raw = String(input == null ? '' : input).replace(/\s+/g, ' ').trim();
  if (s.type === 'photos') return { ok: false, error: 'send_photo' };
  if (s.type === 'enum' || s.type === 'multi') return { ok: false, error: 'choose_button' };
  if (s.type === 'int') {
    const cleaned = raw.replace(/[\s ]/g, '').replace(/(сом|сомов|som|km|км)\.?$/i, '');
    const max = maxOf(s);
    if (!/^\d+$/.test(cleaned)) return { ok: false, error: 'bad_number', params: { min: s.min, max } };
    const n = Number(cleaned);
    if (n < s.min || n > max) return { ok: false, error: 'bad_number', params: { min: s.min, max } };
    return { ok: true, value: n };
  }
  const value = s.normalize ? s.normalize(raw) : raw;
  if (value.length < s.min || value.length > s.max) {
    return { ok: false, error: s.min > 1 ? 'bad_text_len' : 'bad_text_max', params: { min: s.min, max: s.max } };
  }
  return { ok: true, value };
}

// A fresh draft copied from an existing car (SPEC §6.3).
function copyFields(src) {
  const out = {};
  for (const s of STEPS) if (s.type !== 'photos' && !COPY_EXCLUDED.includes(s.key)) out[s.key] = src[s.key];
  out.city = src.city;
  out.copiedFromId = src.id;
  return out;
}

// Where «Продолжить» resumes a draft.
function resumeStep(car) {
  if (car.draftStep && (car.draftStep === 'summary' || BY_KEY[car.draftStep])) return car.draftStep;
  return missingRequired(car)[0] || 'summary';
}

module.exports = {
  STEPS, COPY_STEPS, MAKES, SEATS, AVAIL_PRESETS,
  step, stepByIndex, applies, maxOf, sequence, nextStep, prevStep,
  missingRequired, inapplicableFields, parseText, copyFields, resumeStep, isEmpty
};
