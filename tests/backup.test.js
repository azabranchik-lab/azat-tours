// lib/backup.js: the archive holds every content file (and photos when asked), opens with the
// system tar, restores byte for byte, and never writes outside content/ and public/images/.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const Backup = require('../lib/backup');

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'azat-backup-'));
  fs.mkdirSync(path.join(root, 'content', 'before-2026-10-25-x'), { recursive: true });
  fs.mkdirSync(path.join(root, 'public', 'images', 'tours'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content', 'tours.json'), JSON.stringify([{ id: 1, name: 'Song-Kul Horse Trek — ünïcode ✓' }]));
  fs.writeFileSync(path.join(root, 'content', 'leads.json'), '[]');
  fs.writeFileSync(path.join(root, 'content', '.migrations.json'), '["a"]');
  fs.writeFileSync(path.join(root, 'content', 'tours.json.bak'), 'old');
  fs.writeFileSync(path.join(root, 'content', 'before-2026-10-25-x', 'tours.json'), 'snapshot');
  fs.writeFileSync(path.join(root, 'public', 'images', 'tours', 'photo-1.jpg'), Buffer.alloc(70000, 7));
  return root;
}

test('content archive: every top-level content file, no .bak, no snapshots, no photos', async () => {
  const root = project();
  const a = await Backup.makeArchive(root, { date: new Date('2026-10-25T00:00:00Z') });
  assert.strictEqual(a.name, 'azat-content-backup-2026-10-25.tar.gz');
  const names = Backup.readArchive(a.buffer).map(e => e.name).sort();
  assert.deepStrictEqual(names, ['content/.migrations.json', 'content/leads.json', 'content/tours.json']);
  assert.ok(!a.tooBig);
});

test('full archive adds photos; the system tar lists the same files; contents round-trip byte for byte', async () => {
  const root = project();
  const a = await Backup.makeArchive(root, { images: true });
  const entries = Backup.readArchive(a.buffer);
  assert.ok(entries.some(e => e.name === 'public/images/tours/photo-1.jpg'));
  const tours = entries.find(e => e.name === 'content/tours.json');
  assert.strictEqual(tours.data.toString('utf8'), fs.readFileSync(path.join(root, 'content', 'tours.json'), 'utf8'));
  assert.strictEqual(entries.find(e => e.name.endsWith('photo-1.jpg')).data.length, 70000);
  fs.writeFileSync(path.join(root, a.name), a.buffer);
  let listed;
  // run tar inside the folder with a relative name: on Windows "C:\..." reads as a remote host
  try { listed = execFileSync('tar', ['-tzf', a.name], { cwd: root }).toString().trim().split(/\r?\n/).sort(); }
  catch (e) { if (e.code === 'ENOENT') return; throw e; }   // no tar on this machine: skip only that part
  assert.deepStrictEqual(listed, entries.map(e => e.name).sort(), 'system tar reads our archive');
});

test('long paths are stored with the ustar prefix and read back', () => {
  const name = 'public/images/' + 'a'.repeat(60) + '/' + 'b'.repeat(60) + '/photo.jpg';
  const back = Backup.untar(Backup.tar([{ name, data: Buffer.from('x') }]));
  assert.strictEqual(back[0].name, name);
});

test('restore refuses paths outside content/ and public/images/', () => {
  for (const bad of ['config.json', 'server.js', 'content/../config.json', 'public/index.html', 'content/sub/dir.json']) {
    const buf = zlib.gzipSync(Backup.tar([{ name: bad, data: Buffer.from('x') }]));
    assert.throws(() => Backup.readArchive(buf), /unexpected path/, bad);
  }
});

test('schedule clock is Bishkek time (UTC+6)', () => {
  const t = Backup.bishkekNow(new Date('2026-10-24T21:30:00Z'));   // 03:30 on Sunday 25 October in Bishkek
  assert.deepStrictEqual(t, { hour: 3, day: '2026-10-25', weekday: 0 });
});

test('daily schedule: once per Bishkek day at 10:xx, photos on Sundays, nothing at other hours', () => {
  assert.deepStrictEqual(Backup.due({}, new Date('2026-10-25T04:05:00Z')), { day: '2026-10-25', images: true }, 'Sunday 10:05 Bishkek: content + photos');
  assert.strictEqual(Backup.due({ lastDay: '2026-10-25' }, new Date('2026-10-25T04:15:00Z')), null, 'already sent today');
  assert.deepStrictEqual(Backup.due({ lastDay: '2026-10-25' }, new Date('2026-10-26T04:01:00Z')), { day: '2026-10-26', images: false }, 'Monday: content only');
  assert.strictEqual(Backup.due({}, new Date('2026-10-25T10:00:00Z')), null, '16:00 in Bishkek: not the hour');
  assert.strictEqual(Backup.due(null, new Date('2026-10-25T03:59:00Z')), null, '09:59: not yet');
  assert.deepStrictEqual(Backup.due({}, new Date('2026-10-24T21:05:00Z'), 3), { day: '2026-10-25', images: true }, 'the hour is a parameter');
});
