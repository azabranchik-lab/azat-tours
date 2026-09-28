// SQLite access for the car-partners bot. The driver is hidden here so it can be
// swapped in one place: built-in node:sqlite (Node >= 22.13) first, better-sqlite3
// as a fallback for older Node. Both expose the same prepare().get/all/run + exec
// surface we use. Only positional `?` params are used, since the two drivers
// treat named params differently.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function openDriver(file) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(file);
  } catch (e) {
    if (e.code !== 'ERR_UNKNOWN_BUILTIN_MODULE' && e.code !== 'MODULE_NOT_FOUND') throw e;
  }
  let Better;
  try { Better = require('better-sqlite3'); } catch (e) {
    throw new Error('No SQLite driver: need Node >= 22.13 (node:sqlite) or `npm install better-sqlite3`');
  }
  return new Better(file);
}

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => /^\d+-.*\.sql$/.test(f)).sort();
  for (const f of files) {
    const version = parseInt(f, 10);
    if (version <= current) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
      console.log(`[partners] migration applied: ${f}`);
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`[partners] migration ${f} failed: ${e.message}`);
    }
  }
}

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = openDriver(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  return db;
}

// Short url-safe ids: fit comfortably in 64-byte callback_data (scope:action:id).
const newId = () => crypto.randomBytes(8).toString('base64url');
const now = () => new Date().toISOString();

module.exports = { open, newId, now };
