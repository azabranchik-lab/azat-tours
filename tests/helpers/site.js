// Starts an isolated copy of the site for tests: server code, lib/ and data/ are copied into a
// temp folder, public/ and node_modules/ are linked, and there is no config.json, so the copy has
// no Telegram token (no real notifications, preview disabled) and writes leads and chats into its
// own content/. Content: a copy of the local content/*.json when present, otherwise the server
// falls back to the committed public/*-data.js (that is what CI sees).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..', '..');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
const link = (target, at) => fs.symlinkSync(target, at, 'junction');   // 'junction' works without admin on Windows; a symlink elsewhere

function makeCopy({ content = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'azat-site-'));
  for (const f of ['server.js', 'package.json']) fs.copyFileSync(path.join(REPO, f), path.join(root, f));
  copyDir(path.join(REPO, 'lib'), path.join(root, 'lib'));
  copyDir(path.join(REPO, 'data'), path.join(root, 'data'));
  link(path.join(REPO, 'public'), path.join(root, 'public'));
  link(path.join(REPO, 'node_modules'), path.join(root, 'node_modules'));
  fs.mkdirSync(path.join(root, 'content'));
  const src = path.join(REPO, 'content');
  if (content && fs.existsSync(path.join(src, 'tours.json'))) {
    for (const f of ['tours.json', 'posts.json', 'sights.json', 'site.json'])
      if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(root, 'content', f));
    fs.writeFileSync(path.join(root, 'content', 'reviews.json'), '[]');   // no real reviews in tests
  }
  return root;
}

// Resolves to { base, root, stop() }.
function startSite(opts = {}) {
  const root = makeCopy(opts);
  const port = 20000 + Math.floor(Math.random() * 20000);
  const env = Object.assign({}, process.env, { PORT: String(port) });
  delete env.BOT_TOKEN; delete env.OWNER_ID;
  const child = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('site did not start:\n' + log)); }, 15000);
    const onData = d => {
      log += d;
      if (/running at/.test(log)) {
        clearTimeout(timer);
        resolve({
          base: 'http://127.0.0.1:' + port, root, log: () => log,
          stop: () => new Promise(r => { child.once('exit', r); child.kill(); }),
        });
      }
    };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.on('exit', code => { clearTimeout(timer); if (!/running at/.test(log)) reject(new Error('site exited ' + code + ':\n' + log)); });
  });
}

const hasContent = () => fs.existsSync(path.join(REPO, 'content', 'tours.json'));
module.exports = { startSite, hasContent, REPO };
