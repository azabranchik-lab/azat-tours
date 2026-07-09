// Regenerate every public/*-data.js from its content/*.json.
// Idempotent. Runs on deploy AFTER `git pull` so committed *-data.js snapshots
// don't overwrite whatever the bot has written on the server since the last deploy.
const c = require('../lib/content');

const tours   = c.regenerateDataFile();
const posts   = c.regeneratePostsFile();
const reviews = c.regenerateReviews();
const guides  = c.regenerateGuides();
c.regenerateSite();
c.regenerateSights();

console.log(`Regenerated: ${tours} tours, ${posts} posts, ${reviews} reviews, ${guides} guides + site + sights`);
