// Consistent one-file backup of the car-partners database (SPEC §2 «Бэкап»):
//   npm run backup-partners  →  backups/partners-YYYY-MM-DD.db
// VACUUM INTO gives a clean copy even while the bot is running (WAL mode).
// Only the newest backup is kept on the server (25 GB disk): download it elsewhere.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB = path.join(ROOT, 'content', 'partners.db');
const DIR = path.join(ROOT, 'backups');

if (!fs.existsSync(DB)) { console.error('No database yet:', DB); process.exit(1); }
fs.mkdirSync(DIR, { recursive: true });
const out = path.join(DIR, `partners-${new Date().toISOString().slice(0, 10)}.db`);
if (fs.existsSync(out)) fs.unlinkSync(out); // VACUUM INTO refuses to overwrite

let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { DatabaseSync = require('better-sqlite3'); }
const db = new DatabaseSync(DB);
db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
db.close();

for (const f of fs.readdirSync(DIR)) {
  if (/^partners-\d{4}-\d{2}-\d{2}\.db$/.test(f) && path.join(DIR, f) !== out) fs.unlinkSync(path.join(DIR, f));
}
console.log(`Backup: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB). Photos: copy content/car-photos/.`);
