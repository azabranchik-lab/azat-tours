// One-time: take the current window.TOURS (from tours-data.js) and write it to
// content/tours.json so the bot has a source of truth to edit.
const fs = require('fs');
const path = require('path');
const { TOURS_DATA_JS, saveTours } = require('../lib/content');

const js = fs.readFileSync(TOURS_DATA_JS, 'utf8');
// tours-data.js is `window.TOURS = [...];` — evaluate it safely.
const sandbox = { window: {} };
new Function('window', js)(sandbox.window);
const tours = sandbox.window.TOURS || [];

saveTours(tours);
console.log(`Seeded content/tours.json with ${tours.length} tours and regenerated tours-data.js`);
