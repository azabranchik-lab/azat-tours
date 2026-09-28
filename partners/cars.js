// Car rows. JSON columns (features, rentalModes, en) are parsed on read and
// stringified on write, so callers always see arrays/objects.
const { newId, now } = require('./db');

const JSON_FIELDS = ['features', 'rentalModes', 'en'];
const CAR_FIELDS = [
  'status', 'availability', 'make', 'model', 'year', 'bodyType', 'transmission', 'drive', 'fuel', 'seats',
  'color', 'plateNumber', 'mileageKm', 'features', 'description', 'rentalModes', 'priceSelfDrive',
  'priceWithDriver', 'longTermDiscount', 'deposit', 'insurance', 'delivery', 'driverRequirements',
  'restrictions', 'availabilityNote', 'city', 'en', 'rejectReason', 'copiedFromId', 'submittedAt',
  'approvedAt', 'draftStep'
];

function createCars(db) {
  const parse = row => {
    if (!row) return null;
    const c = { ...row };
    for (const k of JSON_FIELDS) {
      try { c[k] = row[k] ? JSON.parse(row[k]) : (k === 'en' ? null : []); } catch (e) { c[k] = k === 'en' ? null : []; }
    }
    return c;
  };
  const toDb = (k, v) => (JSON_FIELDS.includes(k) ? (v == null ? null : JSON.stringify(v)) : (v === undefined ? null : v));

  const byId = db.prepare('SELECT * FROM cars WHERE id = ?');

  return {
    get: id => parse(byId.get(id)),

    create(partnerId, fields = {}) {
      const id = newId();
      const ts = now();
      const keys = Object.keys(fields).filter(k => CAR_FIELDS.includes(k));
      const cols = ['id', 'partnerId', 'createdAt', 'updatedAt', ...keys];
      db.prepare(`INSERT INTO cars (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
        .run(id, partnerId, ts, ts, ...keys.map(k => toDb(k, fields[k])));
      return parse(byId.get(id));
    },

    update(id, fields) {
      const keys = Object.keys(fields).filter(k => CAR_FIELDS.includes(k));
      if (!keys.length) return parse(byId.get(id));
      db.prepare(`UPDATE cars SET ${keys.map(k => `${k} = ?`).join(', ')}, updatedAt = ? WHERE id = ?`)
        .run(...keys.map(k => toDb(k, fields[k])), now(), id);
      return parse(byId.get(id));
    },

    // Hard delete, only used for drafts (published cars are archived instead).
    remove(id) {
      db.prepare('DELETE FROM cars WHERE id = ?').run(id);
    },

    latestDraft(partnerId) {
      return parse(db.prepare(`SELECT * FROM cars WHERE partnerId = ? AND status = 'DRAFT' ORDER BY updatedAt DESC LIMIT 1`).get(partnerId));
    },

    // Cars that can serve as a copy template: anything the partner finished at least once.
    copySources(partnerId, limit = 5) {
      return db.prepare(`SELECT * FROM cars WHERE partnerId = ? AND status NOT IN ('DRAFT', 'ARCHIVED') ORDER BY updatedAt DESC LIMIT ?`)
        .all(partnerId, limit).map(parse);
    }
  };
}

module.exports = { createCars, CAR_FIELDS };
