// Atomic file write: write a sibling .tmp, keep a .bak of the last good version,
// then rename over the target. rename() on one filesystem is atomic, so the file is
// always either fully old or fully new, even if the process dies mid-write.
const fs = require('fs');

function writeFileAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data, { mode: 0o600 }); // config holds the bot token: owner-only
  try { if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch (e) { /* best effort */ }
  fs.renameSync(tmp, file);
}

module.exports = { writeFileAtomic };
