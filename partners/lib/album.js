// Send a car's photos as Telegram albums (10 per album max). Built from the
// processed files, i.e. exactly what the site will show, re-encoded as JPEG so
// it also works for photos that arrived as documents.
const sharp = require('sharp');
const { InputFile, InputMediaBuilder } = require('grammy');

async function sendAlbum(api, chatId, storage, photos, other = {}) {
  const media = [];
  for (const p of photos) {
    const jpg = await sharp(await storage.read(p.path)).jpeg({ quality: 80 }).toBuffer();
    media.push(InputMediaBuilder.photo(new InputFile(jpg, `${p.angle}.jpg`)));
  }
  for (let i = 0; i < media.length; i += 10) await api.sendMediaGroup(chatId, media.slice(i, i + 10), other);
}

module.exports = { sendAlbum };
