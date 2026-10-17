// Photo step of the wizard (SPEC §6.4): 4 to 6 photos in any order, best sent as
// one album; the first one is the cover. Albums are accepted: grammY handles
// updates one by one, so each album photo is stored as it arrives and only the
// reply is debounced.
const crypto = require('crypto');
const { InlineKeyboard } = require('grammy');
const P = require('../../lib/photos');
const S = require('./steps');

const ALBUM_DEBOUNCE_MS = 1500;
const DISK_ALERT_EVERY_MS = 60 * 60 * 1000;
let lastDiskAlert = 0;

function navKeyboard(ctx, car, mode, withDone) {
  const idx = S.step('photos').index;
  const kb = new InlineKeyboard();
  if (withDone) kb.text(ctx.t('btn_done'), `w:${idx}:d`).row();
  if (mode === 'edit' || S.prevStep(car, 'photos', mode)) kb.text(ctx.t('btn_back'), `w:${idx}:b`);
  kb.text(ctx.t('btn_cancel'), `w:${idx}:c`);
  return kb;
}

// Ask for photos: the full explanation while there are none yet, then how many
// are in and how many more can come. «Готово» once there are enough.
async function ask(ctx, car, mode) {
  const { clearKb, counter } = require('./handlers');
  const n = ctx.cars.photos(car.id).length;
  await clearKb(ctx, ctx.partner.state && ctx.partner.state.qmsg);
  let text;
  if (!n) text = counter(ctx, car, 'photos', mode) + ctx.t('photos_intro', { min: P.MIN_PHOTOS, max: P.MAX_PHOTOS });
  else if (n < P.MIN_PHOTOS) text = ctx.t('photos_need', { n, need: P.MIN_PHOTOS - n });
  else text = ctx.t('photos_more', { n, max: P.MAX_PHOTOS, left: P.MAX_PHOTOS - n });
  const msg = await ctx.reply(text, { reply_markup: navKeyboard(ctx, car, mode, n >= P.MIN_PHOTOS) });
  if (mode !== 'edit') ctx.cars.update(car.id, { draftStep: 'photos' });
  ctx.setState({ flow: 'car', carId: car.id, step: 'photos', mode, qmsg: msg.message_id });
}

// What Telegram says about the incoming file.
function incoming(msg) {
  if (msg.photo) {
    const p = msg.photo[msg.photo.length - 1]; // largest size
    return { kind: 'photo', fileId: p.file_id, uniqueId: p.file_unique_id, size: p.file_size };
  }
  const d = msg.document;
  return { kind: 'document', fileId: d.file_id, uniqueId: d.file_unique_id, size: d.file_size, mime: d.mime_type, fileName: d.file_name };
}

async function diskOk(ctx) {
  const free = ctx.storage.freeBytes();
  if (free === null || free >= ctx.cfg.minFreeDiskGb * 1024 ** 3) return true;
  if (ctx.cfg.adminChatId && Date.now() - lastDiskAlert > DISK_ALERT_EVERY_MS) {
    lastDiskAlert = Date.now();
    ctx.api.sendMessage(ctx.cfg.adminChatId, ctx.t('admin_disk_low', { free: (free / 1024 ** 3).toFixed(1) })).catch(() => {});
  }
  return false;
}

// Store one processed photo: appended at the end, or in place of `replace`
// (same position; used when the admin sends a fixed photo).
async function store(ctx, car, file, img, replace = null) {
  const angle = replace ? replace.angle : 'EXTRA';
  const base = `${car.id}/${angle}-${crypto.randomUUID()}`;
  await ctx.storage.save(`${base}.webp`, img.main);
  await ctx.storage.save(`${base}-thumb.webp`, img.thumb);
  const photos = ctx.cars.photos(car.id);
  ctx.cars.addPhoto(car.id, {
    angle, telegramFileId: file.fileId, telegramFileUniqueId: file.uniqueId,
    path: `${base}.webp`, thumbPath: `${base}-thumb.webp`, width: img.width, height: img.height,
    sortOrder: replace ? replace.sortOrder : photos.length ? Math.max(...photos.map(p => p.sortOrder)) + 1 : 0
  }, replace ? [replace.id] : []);
  if (replace) {
    await ctx.storage.delete(replace.path);
    await ctx.storage.delete(replace.thumbPath);
  }
}

// Debounced album replies, per user.
const pending = new Map(); // userId -> { timer, saved, dropped }

async function report(ctx, dropped) {
  const st = ctx.store.getById(ctx.partner.id).state;
  if (!st || st.flow !== 'car' || st.step !== 'photos') return;
  ctx.partner.state = st;
  const car = ctx.cars.get(st.carId);
  if (!car) return;
  if (dropped) await ctx.reply(ctx.t('photos_dropped', { max: P.MAX_PHOTOS, n: dropped }));
  // All slots filled: nothing more to ask, straight to the summary.
  if (ctx.cars.photos(car.id).length >= P.MAX_PHOTOS) return require('./summary').show(ctx, car, { withPhotos: true });
  return ask(ctx, car, st.mode);
}

async function onPhoto(ctx) {
  // Hold the album reply while this photo is being processed; re-armed at the end.
  const groupId = ctx.message.media_group_id;
  const held = groupId ? pending.get(ctx.from.id) : null;
  if (held) clearTimeout(held.timer);
  try {
    return await handlePhoto(ctx);
  } finally {
    if (groupId) armAlbumReply(ctx);
  }
}

function armAlbumReply(ctx) {
  const key = ctx.from.id;
  const p = pending.get(key);
  if (!p) return;
  clearTimeout(p.timer);
  const delay = ctx.cfg.albumDebounceMs !== undefined ? ctx.cfg.albumDebounceMs : ALBUM_DEBOUNCE_MS;
  p.timer = setTimeout(async () => {
    pending.delete(key);
    try { await report(ctx, p.dropped); } catch (e) { console.error('[partners] album report failed:', e.message); }
    p.resolve();
  }, delay);
}

function albumEntry(ctx) {
  let p = pending.get(ctx.from.id);
  if (!p) {
    p = { dropped: 0 };
    p.done = new Promise(resolve => { p.resolve = resolve; });
    pending.set(ctx.from.id, p);
  }
  return p;
}

async function handlePhoto(ctx) {
  const st = ctx.partner.state;
  if (!st || st.flow !== 'car') return false; // not ours
  const { ownDraft } = require('./handlers');
  const car = ownDraft(ctx, st.carId);
  if (!car) return false;
  if (st.step !== 'photos') { await ctx.reply(ctx.t('photo_not_now')); return true; }
  const album = Boolean(ctx.message.media_group_id);

  // Already full: an album's extra photos are counted for one message, a single photo is told at once.
  if (ctx.cars.photos(car.id).length >= P.MAX_PHOTOS) {
    if (album) { albumEntry(ctx).dropped++; return true; }
    await ctx.reply(ctx.t('photos_full', { max: P.MAX_PHOTOS }));
    return true;
  }

  const file = incoming(ctx.message);
  const check = P.checkIncoming(file, ctx.cfg.photoMaxMb);
  if (!check.ok) { await ctx.reply(ctx.t(check.error, { mb: ctx.cfg.photoMaxMb })); return true; }
  if (!(await diskOk(ctx))) { await ctx.reply(ctx.t('photo_unavailable')); return true; }

  const buf = await ctx.download(file.fileId);
  if (buf.length > ctx.cfg.photoMaxMb * 1024 * 1024) { await ctx.reply(ctx.t('photo_too_big', { mb: ctx.cfg.photoMaxMb })); return true; }
  const img = await P.processImage(buf);
  if (!img.ok) { await ctx.reply(ctx.t(img.error)); return true; }

  // Count again after the async work: album photos are handled in order, but another
  // one may have filled the last slot meanwhile.
  if (ctx.cars.photos(car.id).length >= P.MAX_PHOTOS) {
    if (album) albumEntry(ctx).dropped++;
    else await ctx.reply(ctx.t('photos_full', { max: P.MAX_PHOTOS }));
    return true;
  }
  await store(ctx, car, file, img);

  if (!album) { await report(ctx, 0); return true; }
  albumEntry(ctx); // one reply for the whole album once photos stop coming
  return true;
}

// «Готово» under the photo question.
async function onDone(ctx, car) {
  const need = P.photosNeeded(ctx.cars.photos(car.id));
  if (need) return ctx.answerCallbackQuery({ text: ctx.t('photos_missing', { n: need }), show_alert: true });
  await ctx.answerCallbackQuery();
  return require('./summary').show(ctx, car, { withPhotos: true });
}

// Remove every photo (summary → «Загрузить фото заново»).
async function clearAll(ctx, car) {
  for (const p of ctx.cars.photos(car.id)) {
    ctx.cars.removePhoto(p.id);
    await ctx.storage.delete(p.path);
    await ctx.storage.delete(p.thumbPath);
  }
}

// For tests: wait until debounced album replies have been sent.
const flushAlbums = () => Promise.all([...pending.values()].map(p => p.done));

module.exports = { ask, onPhoto, onDone, clearAll, flushAlbums, incoming, store };
