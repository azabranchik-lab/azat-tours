// Partner rows. Dialog state lives in partners.state (JSON), so a restart never
// loses where a partner was (SPEC §2).
const { newId, now } = require('./db');

const PARTNER_FIELDS = ['username', 'lang', 'name', 'phone', 'city', 'offerAcceptedAt', 'offerVersion', 'status'];

function createStore(db) {
  const parse = row => {
    if (!row) return null;
    const p = { ...row };
    try { p.state = row.state ? JSON.parse(row.state) : null; } catch (e) { p.state = null; }
    return p;
  };

  const byTg = db.prepare('SELECT * FROM partners WHERE telegramId = ?');
  const byId = db.prepare('SELECT * FROM partners WHERE id = ?');
  const insert = db.prepare(`INSERT INTO partners (id, telegramId, username, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`);
  const setStateStmt = db.prepare('UPDATE partners SET state = ?, updatedAt = ? WHERE id = ?');

  return {
    getByTelegramId: tgId => parse(byTg.get(tgId)),
    getById: id => parse(byId.get(id)),

    // First contact creates an empty (unregistered) partner row.
    getOrCreate(tgId, username) {
      const found = byTg.get(tgId);
      if (found) return parse(found);
      const ts = now();
      insert.run(newId(), tgId, username || null, ts, ts);
      return parse(byTg.get(tgId));
    },

    update(id, fields) {
      const keys = Object.keys(fields).filter(k => PARTNER_FIELDS.includes(k));
      if (!keys.length) return;
      const sql = `UPDATE partners SET ${keys.map(k => `${k} = ?`).join(', ')}, updatedAt = ? WHERE id = ?`;
      db.prepare(sql).run(...keys.map(k => fields[k]), now(), id);
    },

    setState(id, state) {
      setStateStmt.run(state ? JSON.stringify(state) : null, now(), id);
    }
  };
}

const isRegistered = p => !!(p && p.offerAcceptedAt);

module.exports = { createStore, isRegistered };
