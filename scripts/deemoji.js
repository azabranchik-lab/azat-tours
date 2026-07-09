// Replaces emojis across the website (HTML + front-end JS) with clean line-art SVG icons.
// Telegram-facing files (bot.js, server.js) keep emojis — they read fine in Telegram.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'public');

const S = (body, fill) => `<svg class="${fill ? 'gicf' : 'gico'}" viewBox="0 0 24 24" ${fill ? '' : 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

const MAP = {
  '🏔️': S('<path d="m2 20 6.5-12L13 17l3-5 6 8Z"/><path d="m8.5 8 2.2 4"/>'),
  '🏔': S('<path d="m2 20 6.5-12L13 17l3-5 6 8Z"/><path d="m8.5 8 2.2 4"/>'),
  '⛰️': S('<path d="m2 20 6.5-12L13 17l3-5 6 8Z"/>'),
  '🛡️': S('<path d="M12 3 5 6v5c0 4 3 7.2 7 9 4-1.8 7-5 7-9V6Z"/><path d="m9 12 2 2 4-4"/>'),
  '🤝': S('<path d="M3 12h3l3-3 3 3 3-3 3 3h3"/><path d="M6 12v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4"/>'),
  '🌿': S('<path d="M4 20c8 2 15-4 15-14C9 6 3 11 4 20Z"/><path d="M4 20c3-6 7-9 12-11"/>'),
  '🧭': S('<circle cx="12" cy="12" r="9"/><path d="m15 9-2.2 5.2L8 16l2-5Z"/>'),
  '💬': S('<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4V6a1 1 0 0 1 1-1Z"/>'),
  '💎': S('<path d="M12 3 3 10l9 11 9-11Z"/><path d="M3 10h18M9 3 7 10M15 3l2 7"/>'),
  '✦': S('<path d="M12 4l1.7 5.3L19 11l-5.3 1.7L12 18l-1.7-5.3L5 11l5.3-1.7Z"/>'),
  '♨️': S('<path d="M12 4c3 4 4.5 6 4.5 8.5a4.5 4.5 0 0 1-9 0C7.5 10 9 8 12 4Z"/>'),
  '⛺': S('<path d="M12 4 3 20h18Z"/><path d="M12 4v16"/>'),
  '🏕️': S('<path d="M12 4 3 20h18Z"/><path d="M12 4v16"/>'),
  '🥾': S('<path d="M7 4v8l-2 1v4h11a4 4 0 0 0 0-7c-3 0-4-1-4-3V4Z"/><path d="M5 17h14"/>'),
  '🧥': S('<path d="M8 4 4 7l2 3.5V20h12v-9.5L20 7l-4-3-4 3-4-3Z"/><path d="M12 4v16"/>'),
  '🛏️': S('<path d="M3 8v11M3 13h18v6M21 19v-3.5a2.5 2.5 0 0 0-2.5-2.5H11v3"/>'),
  '🔋': S('<rect x="3" y="8" width="15" height="9" rx="2"/><path d="M21 11.5v3"/><path d="M7 11v3"/>'),
  '💊': S('<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M12 10v5M9.5 12.5h5M9 6V5h6v1"/>'),
  '🎒': S('<path d="M6 9a6 6 0 0 1 12 0v11H6Z"/><path d="M9 9V6.5a3 3 0 0 1 6 0V9M9 14h6"/>'),
  '✈️': S('<path d="M10 21 12 14 3.5 11 21 4l-4 17-5-5Z"/>'),
  '✉️': S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>'),
  '📞': S('<path d="M5 4h3.5l1.8 4.5-2.4 1.6a11 11 0 0 0 5 5l1.6-2.4L20 15.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>'),
  '📅': S('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>'),
  '📍': S('<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/>'),
  '🚗': S('<path d="m5 16 1.2-6.5A2 2 0 0 1 8.2 8h7.6a2 2 0 0 1 2 1.5L19 16M4 16h16v3H4Z"/><circle cx="7.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>'),
  '🔒': S('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  '⚡': S('<path d="M13 3 5 14h6l-1 7 8-11h-6Z"/>'),
  '🍃': S('<path d="M5 19c8 1 14-5 14-14C10 5 4 11 5 19Z"/><path d="M5 19c3-5 6-8 11-10"/>'),
  '🚶': S('<circle cx="13" cy="5" r="1.6"/><path d="m12 9-3 4 3 1.5 1 6.5M12 9l4 1.5M9 13l-2 6.5"/>'),
  '🏨': S('<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20v-3h4v3"/>'),
  '🔁': S('<path d="M4 9a8 8 0 0 1 13.5-3L20 8M20 15a8 8 0 0 1-13.5 3L4 16"/><path d="M20 4v4h-4M4 20v-4h4"/>'),
  '➤': S('<path d="m4 12 15-7-6 14-2.5-6.5Z"/>'),
  '🟢': S('<circle cx="12" cy="12" r="7" fill="#00AA6C"/>', true),
  '🔵': S('<circle cx="12" cy="12" r="7" fill="#4285F4"/>', true),
  '👋': '',
  '🏞️': S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="8" cy="9" r="1.3"/>'),
  '📜': S('<path d="M6 4h11a1 1 0 0 1 1 1v13a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2Z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  '🛟': S('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>'),
  '⛰': S('<path d="m2 20 6.5-12L13 17l3-5 6 8Z"/><path d="m8.5 8 2.2 4"/>'),
  '🐎': S('<path d="M5 20c-1-7 3-10 7-11l1.4-3.4 3 1.4-1 3.4c1.6 1 2.6 3 2.6 6"/><path d="M5 20h10"/>'),
  '🌅': S('<path d="M3 18h18M6 18a6 6 0 0 1 12 0"/><path d="M12 5v2.5M5.5 9 7 10.5M18.5 9 17 10.5"/>'),
  '🆕': '', '📷': '', '📂': '', '⏱': '', '✍️': '', '🗑': '', '⭐': '', '✓': S('<path d="M5 12.5 10 17 19 7"/>')
};

const files = [];
for (const f of fs.readdirSync(ROOT)) {
  if (f.endsWith('.html')) files.push(f);
}
['tours-render.js', 'tour-detail.js', 'builder.js', 'chat.js', 'post-render.js', 'blog-render.js', 'script.js'].forEach(f => { if (fs.existsSync(path.join(ROOT, f))) files.push(f); });

let total = 0;
for (const f of files) {
  const p = path.join(ROOT, f);
  let s = fs.readFileSync(p, 'utf8'), n = 0;
  for (const [emo, svg] of Object.entries(MAP)) {
    if (s.includes(emo)) { const c = s.split(emo).length - 1; s = s.split(emo).join(svg); n += c; }
  }
  if (n) { fs.writeFileSync(p, s); total += n; console.log(`${f}: ${n} replaced`); }
}
console.log(`Done. ${total} emoji replaced with SVG icons across ${files.length} files.`);
