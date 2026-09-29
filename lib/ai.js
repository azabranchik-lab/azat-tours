// AI drafting for the content pipeline. The owner sends a brief with the FACTS;
// Claude only formats them in the site's voice and invents nothing. Output is a
// draft (never live) that lands in the bot review queue. Model-agnostic on
// purpose (works on Opus/Sonnet/Haiku) so the owner can pick a cheaper model.
const fs = require('fs');
const path = require('path');
const C = require('./content');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) {}
const KEY = process.env.ANTHROPIC_API_KEY || cfg.anthropicApiKey || '';
const MODEL = cfg.aiModel || 'claude-opus-4-7'; // override with "aiModel" in config.json to save cost

let Anthropic = null;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (e) { /* not installed yet */ }

function available() { return !!(KEY && Anthropic); }
function why() {
  if (!Anthropic) return 'the @anthropic-ai/sdk package is not installed (run: npm install @anthropic-ai/sdk)';
  if (!KEY) return 'no Anthropic API key is set (add "anthropicApiKey" to config.json on the server)';
  return '';
}

const POST_CATS = ['Travel guide', 'Planning', 'Culture', 'Practical', 'Gear', 'Horse treks', 'Day tours'];
const TOUR_CATS = ['Combined', 'Horse riding', 'Road trip', 'Off-the-beaten-path', 'Winter tours'];

// Safety net: no em/en dashes ever reach the site, even if the model slips.
const deDash = s => String(s == null ? '' : s).replace(/\s*[—–]\s*/g, ', ');

const STYLE = [
  'You write for Azat Tours, a small-group tour operator based in Kyrgyzstan.',
  'Voice: warm, first-person plural ("we", "our guides"), concrete and grounded, the voice of real people who run these trips. No corporate filler, no hype words, no clichés.',
  'HARD RULES (never break any of these):',
  '1. Never use an em dash or en dash (— or –). Use a comma, a full stop, or rephrase.',
  '2. Write flowing prose in paragraphs. Do not dump bullet-point lists in the body; only use a short list when the content genuinely is a list (like a packing list), otherwise write sentences.',
  '3. Use ONLY facts that appear in the brief. Never invent or guess distances, altitudes, prices, dates, durations, or place names. When a useful fact is missing, insert a literal placeholder in square brackets, for example [check: distance Bishkek to Song-Kol], so the owner can fill it in. Never make a number up.',
  '4. Natural, readable English.'
].join('\n');

const POST_FORMAT = [
  'The body uses this lightweight markup (parsed by the site):',
  '"## Heading" section heading, "### Sub" subheading, "> quote" pull quote, "- item" list item (use sparingly),',
  '"[img:URL|caption]" image (only if the brief supplies a URL), "[tip:Title|Text]" a highlighted tip box, "**bold**" bold, "[text](url)" a link.',
  'Separate paragraphs with a blank line. The first paragraph is the intro and should draw the reader in.'
].join('\n');

function fewShotPosts() {
  try {
    const posts = C.publishedOnly(C.loadPosts()).filter(p => (p.body || '').length > 200).slice(0, 2);
    if (!posts.length) return '';
    return posts.map(p => `TITLE: ${p.title}\nEXCERPT: ${p.excerpt}\nBODY (excerpt):\n${String(p.body).slice(0, 900)}`).join('\n\n---\n\n');
  } catch (e) { return ''; }
}

function client() { return new Anthropic({ apiKey: KEY }); }

function pickToolInput(resp, name) {
  const block = (resp.content || []).find(b => b.type === 'tool_use' && b.name === name);
  if (!block) throw new Error('model did not return the expected structured output');
  return typeof block.input === 'string' ? JSON.parse(block.input) : block.input;
}

async function draftPost(brief) {
  const examples = fewShotPosts();
  const system = [
    { type: 'text', text: STYLE + '\n\n' + POST_FORMAT + (examples ? '\n\nExamples of our existing posts, match this voice:\n\n' + examples : ''), cache_control: { type: 'ephemeral' } }
  ];
  const tool = {
    name: 'write_post', description: 'Return the drafted blog post.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title Case, under 60 characters' },
        excerpt: { type: 'string', description: 'one sentence shown on the blog list' },
        category: { type: 'string', enum: POST_CATS },
        body: { type: 'string', description: 'full article using the site markup' }
      },
      required: ['title', 'excerpt', 'category', 'body'], additionalProperties: false
    }
  };
  const resp = await client().messages.create({
    model: MODEL, max_tokens: 12000, system, tools: [tool], tool_choice: { type: 'tool', name: 'write_post' },
    messages: [{ role: 'user', content: 'Write a blog post from my brief below. Use only my facts, invent no numbers or place names, and mark anything missing with [check: ...].\n\nBRIEF:\n' + brief }]
  });
  const out = pickToolInput(resp, 'write_post');
  return { title: deDash(out.title), excerpt: deDash(out.excerpt), category: POST_CATS.includes(out.category) ? out.category : 'Travel guide', body: deDash(out.body) };
}

async function draftTour(brief) {
  const system = [{ type: 'text', text: STYLE, cache_control: { type: 'ephemeral' } }];
  const tool = {
    name: 'write_tour', description: 'Return the drafted tour.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'tour name, Title Case' },
        category: { type: 'string', enum: TOUR_CATS },
        duration: { type: 'string', description: 'e.g. "7 days"' },
        season: { type: 'string', description: 'best season, from the brief only' },
        summary: { type: 'string', description: '2 to 4 sentences, no em dashes' },
        highlights: { type: 'array', items: { type: 'string' }, description: '3 to 6 short highlight phrases' },
        itinerary: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'integer' },
              title: { type: 'string' },
              desc: { type: 'array', items: { type: 'string' }, description: 'one or more paragraphs' },
              transfer: { type: 'string' }, activity: { type: 'string' }, meals: { type: 'string' }, overnight: { type: 'string' }
            },
            required: ['day', 'title', 'desc'], additionalProperties: false
          }
        }
      },
      required: ['name', 'category', 'duration', 'summary', 'highlights', 'itinerary'], additionalProperties: false
    }
  };
  const resp = await client().messages.create({
    model: MODEL, max_tokens: 12000, system, tools: [tool], tool_choice: { type: 'tool', name: 'write_tour' },
    messages: [{ role: 'user', content: 'Draft a tour from my rough program below. Use only my facts (route, days, distances, altitudes, seasons); invent nothing, and mark anything missing with [check: ...].\n\nPROGRAM:\n' + brief }]
  });
  const out = pickToolInput(resp, 'write_tour');
  return {
    name: deDash(out.name), category: TOUR_CATS.includes(out.category) ? out.category : 'Combined',
    duration: deDash(out.duration), season: deDash(out.season || ''), summary: deDash(out.summary),
    highlights: (out.highlights || []).map(deDash),
    itinerary: (out.itinerary || []).map((d, i) => ({
      day: d.day || i + 1, title: deDash(d.title || ''),
      desc: (Array.isArray(d.desc) ? d.desc : [d.desc]).filter(Boolean).map(deDash),
      transfer: deDash(d.transfer || ''), activity: deDash(d.activity || ''), meals: deDash(d.meals || ''), overnight: deDash(d.overnight || ''),
      wc: '', internet: ''
    }))
  };
}

// Car-partners moderation: translate a partner's Russian/Kyrgyz car texts into
// English for the site. `fields` is { key: text }; returns the same keys in English.
async function translateCarFields(fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return {};
  const system = [{
    type: 'text', cache_control: { type: 'ephemeral' },
    text: [
      'You translate car rental listings written by local car owners in Kyrgyzstan (Russian or Kyrgyz) into natural English for foreign travellers on the Azat Tours website.',
      'Translate faithfully: keep every fact, number, limit and condition; add nothing, drop nothing, no marketing fluff.',
      'Fix obvious typos silently. Keep units (km, som, days). Never use an em dash or en dash.',
      'Short fields (like a colour) stay short: one or two words.'
    ].join('\n')
  }];
  const tool = {
    name: 'car_translation', description: 'Return the English translation of each field.',
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(keys.map(k => [k, { type: 'string' }])),
      required: keys, additionalProperties: false
    }
  };
  const resp = await client().messages.create({
    model: MODEL, max_tokens: 4000, system, tools: [tool], tool_choice: { type: 'tool', name: 'car_translation' },
    messages: [{ role: 'user', content: 'Translate these fields to English:\n\n' + JSON.stringify(fields, null, 2) }]
  });
  const out = pickToolInput(resp, 'car_translation');
  return Object.fromEntries(keys.map(k => [k, deDash(out[k] || '').trim()]));
}

module.exports = { available, why, draftPost, draftTour, translateCarFields, MODEL };
