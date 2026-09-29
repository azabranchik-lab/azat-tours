// Daily disk cleanup (SPEC §6.4 «Защита диска»): photos of archived cars after
// 30 days, abandoned drafts after 90 days. Logs how much space photos take.
const DAY = 24 * 60 * 60 * 1000;
const ARCHIVED_DAYS = 30;
const DRAFT_DAYS = 90;

async function runCleanup(conn, storage, nowMs = Date.now()) {
  const iso = days => new Date(nowMs - days * DAY).toISOString();

  const archived = conn.prepare(`SELECT DISTINCT c.id FROM cars c JOIN car_photos p ON p.carId = c.id
    WHERE c.status = 'ARCHIVED' AND c.updatedAt < ?`).all(iso(ARCHIVED_DAYS));
  for (const { id } of archived) {
    await storage.deleteDir(id);
    conn.prepare('DELETE FROM car_photos WHERE carId = ?').run(id);
  }

  const drafts = conn.prepare(`SELECT id FROM cars WHERE status = 'DRAFT' AND updatedAt < ?`).all(iso(DRAFT_DAYS));
  for (const { id } of drafts) {
    await storage.deleteDir(id);
    conn.prepare('DELETE FROM cars WHERE id = ?').run(id); // photos go with it (ON DELETE CASCADE)
  }

  return { archivedCleared: archived.length, draftsDeleted: drafts.length, usedBytes: storage.usedBytes(), freeBytes: storage.freeBytes() };
}

// First run a minute after start, then once a day.
function scheduleCleanup(conn, storage) {
  const run = async () => {
    try {
      const r = await runCleanup(conn, storage);
      const mb = n => (n === null ? '?' : (n / 1024 / 1024).toFixed(0));
      console.log(`[partners] cleanup: ${r.archivedCleared} archived cars cleared, ${r.draftsDeleted} old drafts deleted; photos ${mb(r.usedBytes)} MB, disk free ${mb(r.freeBytes)} MB`);
    } catch (e) {
      console.error('[partners] cleanup failed:', e.message);
    }
  };
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, DAY).unref();
}

module.exports = { runCleanup, scheduleCleanup, ARCHIVED_DAYS, DRAFT_DAYS };
