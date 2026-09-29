// Photo step of the wizard (SPEC §6.4): 8 required angles in order, then up to
// 5 extras. Albums are accepted: grammY handles updates one by one, so each
// album photo is stored as it arrives and only the reply is debounced.
// State extras: { replaceAngle } while replacing one angle from the summary.
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

function angleHint(ctx, car, angle) {
  return car.plateOnPhotos === 'HIDE' && (angle === 'FRONT' || angle === 'BACK') ? '\n' + ctx.t('plate_hint') : '';
}

// Ask for the next photo (or extras). `intro` sends the explanation first.
async function ask(ctx, car, mode, { intro = false, replaceAngle = null } = {}) {
  const { clearKb } = require('./handlers');
  const photos = ctx.cars.photos(car.id);
  await clearKb(ctx, ctx.partner.state && ctx.partner.state.qmsg);
  if (intro && !photos.length) await ctx.reply(ctx.t('photos_intro'));

  let text;
  let withDone = false;
  const angle = replaceAngle || P.nextMissingAngle(photos);
  if (replaceAngle) {
    text = ctx.t('photo_replace_ask', { angle: ctx.t('angle_' + replaceAngle) }) + angleHint(ctx, car, replaceAngle);
  } else if (angle) {
    text = ctx.t('photo_ask', { n: P.REQUIRED_ANGLES.indexOf(angle) + 1, angle: ctx.t('angle_' + angle) }) + angleHint(ctx, car, angle);
  } else {
    text = ctx.t('extra_ask', { n: P.extraCount(photos) });
    withDone = true;
  }
  const msg = await ctx.reply(text, { reply_markup: navKeyboard(ctx, car, mode, withDone) });
  if (mode !== 'edit') ctx.cars.update(car.id, { draftStep: 'photos' });
  ctx.setState({ flow: 'car', carId: car.id, step: 'photos', mode, qmsg: msg.message_id, replaceAngle });
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

// Store one processed photo for this angle, replacing the old one (not for EXTRA).
async function store(ctx, car, angle, file, img) {
  const old = ctx.cars.photos(car.id).filter(p => p.angle === angle && angle !== 'EXTRA');
  const base = `${car.id}/${angle}-${crypto.randomUUID()}`;
  await ctx.storage.save(`${base}.webp`, img.main);
  await ctx.storage.save(`${base}-thumb.webp`, img.thumb);
  ctx.cars.addPhoto(car.id, {
    angle, telegramFileId: file.fileId, telegramFileUniqueId: file.uniqueId,
    path: `${base}.webp`, thumbPath: `${base}-thumb.webp`, width: img.width, height: img.height,
    sortOrder: angle === 'EXTRA' ? P.extraCount(ctx.cars.photos(car.id)) : 0
  }, old.map(p => p.id));
  for (const p of old) {
    await ctx.storage.delete(p.path);
    await ctx.storage.delete(p.thumbPath);
  }
}

// Debounced album replies, per user.
const pending = new Map(); // userId -> { timer, angles: [] }

async function report(ctx, angles) {
  const st = ctx.store.getById(ctx.partner.id).state;
  if (!st || st.flow !== 'car' || st.step !== 'photos') return;
  ctx.partner.state = st;
  const car = ctx.cars.get(st.carId);
  if (!car) return;
  if (angles.length) await ctx.reply(ctx.t('photos_filled', { angles: angles.map(a => ctx.t('angle_' + a)).join(', ') }));
  const photos = ctx.cars.photos(car.id);
  const allExtras = !P.nextMissingAngle(photos) && P.extraCount(photos) >= P.MAX_EXTRA;
  if (st.replaceAngle || allExtras) {
    if (st.replaceAngle) await ctx.reply(ctx.t('photo_saved'));
    return require('./summary').show(ctx, car, { withPhotos: true });
  }
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
    try { await report(ctx, p.angles); } catch (e) { console.error('[partners] album report failed:', e.message); }
    p.resolve();
  }, delay);
}

async function handlePhoto(ctx) {
  const st = ctx.partner.state;
  if (!st || st.flow !== 'car') return false; // not ours
  const { ownDraft } = require('./handlers');
  const car = ownDraft(ctx, st.carId);
  if (!car) return false;
  if (st.step !== 'photos') { await ctx.reply(ctx.t('photo_not_now')); return true; }

  const file = incoming(ctx.message);
  const check = P.checkIncoming(file, ctx.cfg.photoMaxMb);
  if (!check.ok) { await ctx.reply(ctx.t(check.error, { mb: ctx.cfg.photoMaxMb })); return true; }
  if (!(await diskOk(ctx))) { await ctx.reply(ctx.t('photo_unavailable')); return true; }

  const buf = await ctx.download(file.fileId);
  if (buf.length > ctx.cfg.photoMaxMb * 1024 * 1024) { await ctx.reply(ctx.t('photo_too_big', { mb: ctx.cfg.photoMaxMb })); return true; }
  const img = await P.processImage(buf);
  if (!img.ok) { await ctx.reply(ctx.t(img.error)); return true; }

  // Decide the angle now (after the async work): updates are handled in order,
  // so album photos fill the angles in the order they were sent.
  const photos = ctx.cars.photos(car.id);
  const angle = st.replaceAngle || P.nextMissingAngle(photos) || (P.extraCount(photos) < P.MAX_EXTRA ? 'EXTRA' : null);
  if (!angle) { await ctx.reply(ctx.t('extras_full')); return true; }
  await store(ctx, car, angle, file, img);

  if (!ctx.message.media_group_id) { await report(ctx, [angle]); return true; }
  // Album: remember the angle; one reply for the whole album once photos stop coming.
  let p = pending.get(ctx.from.id);
  if (!p) {
    p = { angles: [] };
    p.done = new Promise(resolve => { p.resolve = resolve; });
    pending.set(ctx.from.id, p);
  }
  p.angles.push(angle);
  return true;
}

// «Готово» on the extras question.
async function onDone(ctx, car, mode) {
  const missing = P.missingAngles(ctx.cars.photos(car.id));
  if (missing.length) {
    return ctx.answerCallbackQuery({ text: ctx.t('photos_missing', { angles: missing.map(a => ctx.t('angle_' + a)).join(', ') }), show_alert: true });
  }
  await ctx.answerCallbackQuery();
  return require('./summary').show(ctx, car, { withPhotos: true });
}

// Remove all extras (summary → «Доп. фото заново»).
async function clearExtras(ctx, car) {
  for (const p of ctx.cars.photos(car.id).filter(x => x.angle === 'EXTRA')) {
    ctx.cars.removePhoto(p.id);
    await ctx.storage.delete(p.path);
    await ctx.storage.delete(p.thumbPath);
  }
}

// For tests: wait until debounced album replies have been sent.
const flushAlbums = () => Promise.all([...pending.values()].map(p => p.done));

module.exports = { ask, onPhoto, onDone, clearExtras, flushAlbums, incoming, store };
