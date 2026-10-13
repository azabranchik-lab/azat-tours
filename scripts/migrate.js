#!/usr/bin/env node
/**
 * One-time content migrations, run on every deploy (.github/workflows/deploy.yml).
 *
 * content/*.json lives on the server and is edited there through the bot, so a
 * change to existing content cannot arrive with the code: it has to be applied
 * to the server's copy. Each migration below runs exactly once per server; the
 * applied ids are remembered in content/.migrations.json. That matters because
 * some of them overwrite text (summaries), and re-running on a later deploy
 * would undo edits made in the bot since.
 *
 * To add one: append [id, steps] to MIGRATIONS. Never edit or reorder old ones.
 *
 *   node scripts/migrate.js          # apply what is pending
 *   node scripts/migrate.js --list   # show state, change nothing
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const content = require('../lib/content');

const STATE = path.join(content.ROOT, 'content', '.migrations.json');
const run = (script, ...args) => () => execFileSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit' });

// Blurbs that named an old tour series; only these three, the rest stay as edited.
function fixBlurbs() {
  const src = require('./_blurbs.json');
  const tours = content.loadTours();
  let n = 0;
  for (const slug of ['kyrgyzstan-grand-tour-10-days', 'song-kul-kel-suu-altyn-arashan-8-days', 'song-kul-kel-suu-in-a-week-7-days']) {
    const t = tours.find(x => x.slug === slug);
    if (t && src[slug]) { t.blurb = { hook: src[slug].hook, text: src[slug].text }; n++; }
  }
  if (n) content.saveTours(tours);
  console.log(n + ' blurb(s) updated');
}

const MIGRATIONS = [
  ['2026-10-13-rename-tours', [run('rename-tours.js')]],
  ['2026-10-13-summaries', [run('merge-summaries.js')]],
  ['2026-10-13-blurb-fixes', [fixBlurbs]],
  ['2026-10-14-lake-spelling', [run('unify-spelling.js')]],
];

function main() {
  let done = [];
  try { done = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) {}
  const pending = MIGRATIONS.filter(([id]) => !done.includes(id));
  if (process.argv.includes('--list')) {
    MIGRATIONS.forEach(([id]) => console.log((done.includes(id) ? 'done     ' : 'pending  ') + id));
    return;
  }
  if (!pending.length) { console.log('migrations: nothing pending'); return; }
  // An unreadable content folder must stop the deploy here, not publish an empty site.
  if (!content.loadTours().length) { console.error('migrations: content/tours.json is missing or empty, aborting'); process.exit(1); }
  // Keep the content as it was before this batch (content/ is not in git).
  const snap = path.join(content.ROOT, 'content', 'before-' + pending[0][0]);
  if (!fs.existsSync(snap)) {
    fs.mkdirSync(snap, { recursive: true });
    for (const f of ['tours.json', 'posts.json', 'sights.json', 'site.json']) {
      const src = path.join(content.ROOT, 'content', f);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(snap, f));
    }
    console.log('content snapshot: ' + snap);
  }
  for (const [id, steps] of pending) {
    console.log('→ migration ' + id);
    steps.forEach(step => step());
    done.push(id);
    fs.writeFileSync(STATE, JSON.stringify(done, null, 2));
  }
  console.log('migrations: ' + pending.length + ' applied');
}

main();
