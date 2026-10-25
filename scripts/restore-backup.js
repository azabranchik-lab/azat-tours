#!/usr/bin/env node
/**
 * Puts a backup made by the admin bot (lib/backup.js) back in place.
 *
 *   node scripts/restore-backup.js azat-content-backup-2026-10-25.tar.gz --dry   # list what it would write
 *   node scripts/restore-backup.js azat-content-backup-2026-10-25.tar.gz         # restore
 *
 * Writes only content/* and public/images/*. The current content/*.json is copied to
 * content/before-restore-<time>/ first, so a restore can itself be undone. Afterwards it
 * regenerates public/*-data.js; restart the process (pm2 restart azat-tours) so the bot
 * reloads its data.
 */
const fs = require('fs');
const path = require('path');
const { readArchive } = require('../lib/backup');
const content = require('../lib/content');

const file = process.argv[2], dry = process.argv.includes('--dry');
if (!file) { console.error('usage: restore-backup.js <backup.tar.gz> [--dry]'); process.exit(2); }
const entries = readArchive(fs.readFileSync(file));
console.log(entries.length + ' file(s) in ' + path.basename(file) + ':');
entries.slice(0, 40).forEach(e => console.log('  ' + e.name + '  ' + e.data.length + ' B'));
if (entries.length > 40) console.log('  ...');
if (dry) { console.log('[dry] nothing written'); process.exit(0); }

const root = content.ROOT;
const snap = path.join(root, 'content', 'before-restore-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(snap, { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'content'))) {
  const p = path.join(root, 'content', f);
  if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(snap, f));
}
console.log('current content saved to ' + snap);
for (const e of entries) {
  const out = path.join(root, e.name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, e.data);
}
require('./regenerate-all');
console.log('restored ' + entries.length + ' file(s). Now: pm2 restart azat-tours');
