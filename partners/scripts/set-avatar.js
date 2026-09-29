// Set the bot's profile photo from assets/logo.png (Bot API setMyProfilePhoto).
//   npm run avatar
// Telegram wants a JPEG and shows it as a circle; the logo's transparent corners
// are filled with the logo's own navy so the circle crop has no visible edge.
// Run again after a token change (/revoke) only if the photo is missing.
const path = require('path');
const sharp = require('sharp');
const { Api, InputFile } = require('grammy');
const config = require('../config');

const LOGO = path.join(__dirname, '..', 'assets', 'logo.png');
const NAVY = { r: 10, g: 43, b: 69 }; // #0A2B45, the logo background

(async () => {
  const loaded = config.load();
  if (!loaded.ok) { console.error('Config:', loaded.reason); process.exit(1); }
  const jpg = await sharp(LOGO).resize(640, 640).flatten({ background: NAVY }).jpeg({ quality: 92 }).toBuffer();
  const api = new Api(loaded.config.token);
  await api.setMyProfilePhoto({ type: 'static', photo: new InputFile(jpg, 'avatar.jpg') });
  const me = await api.getMe();
  console.log(`Profile photo set for @${me.username}`);
})().catch(e => { console.error('Failed:', e.message); process.exit(1); });
