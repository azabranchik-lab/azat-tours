// Atomic file write: never leave a half-written file on the site.
// A direct fs.writeFileSync can be interrupted mid-write (crash, pm2
// max_memory_restart, full disk), leaving a truncated JSON that then parses
// to [] — one more bot edit would save the catalogue back as a single item and
// wipe the site. Here we write a sibling .tmp, keep a .bak of the last good
// version, then rename the tmp over the target. rename() on the same
// filesystem is atomic, so the target is always either fully old or fully new.
const fs = require('fs');

function writeFileAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data);            // fully written (or throws) before we touch the target
  try { if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch (e) { /* best effort */ }
  fs.renameSync(tmp, file);               // atomic swap
}

module.exports = { writeFileAtomic };
