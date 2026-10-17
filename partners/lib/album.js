// Send a car's photos as Telegram albums (10 per album max). Built from the
// processed files, i.e. exactly what the site will show, re-encoded as JPEG so
// it also works for photos that arrived as documents.
const { toJpeg } = require('./photos');
const { InputFile, InputMediaBuilder } = require('grammy');

async function sendAlbum(api, chatId, storage, photos, other = {}) {
  const media = [];
  for (const [i, p] of photos.entries()) {
    const jpg = await toJpeg(await storage.read(p.path), 80);
    media.push(InputMediaBuilder.photo(new InputFile(jpg, `photo-${i + 1}.jpg`)));
  }
  for (let i = 0; i < media.length; i += 10) await api.sendMediaGroup(chatId, media.slice(i, i + 10), other);
}

module.exports = { sendAlbum };
