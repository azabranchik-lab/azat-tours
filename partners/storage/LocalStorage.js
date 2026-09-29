// StorageDriver backed by a local folder (content/car-photos/ in production).
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

class LocalStorage {
  constructor(root) {
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true });
  }

  // Never let a relative path escape the root.
  abs(rel) {
    const p = path.resolve(this.root, rel);
    if (p !== this.root && !p.startsWith(this.root + path.sep)) throw new Error(`storage: bad path ${rel}`);
    return p;
  }

  async save(rel, buf) {
    const p = this.abs(rel);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, buf);
  }

  read(rel) { return fsp.readFile(this.abs(rel)); }

  async delete(rel) {
    try { await fsp.unlink(this.abs(rel)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }

  async deleteDir(rel) {
    await fsp.rm(this.abs(rel), { recursive: true, force: true });
  }

  publicUrl(rel) { return '/car-photos/' + rel.split(path.sep).join('/'); }

  freeBytes() {
    try { const s = fs.statfsSync(this.root); return s.bavail * s.bsize; } catch (e) { return null; }
  }

  usedBytes() {
    let total = 0;
    const walk = dir => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p); else total += fs.statSync(p).size;
      }
    };
    try { walk(this.root); } catch (e) {}
    return total;
  }
}

module.exports = { LocalStorage };
