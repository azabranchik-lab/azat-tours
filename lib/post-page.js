// Server-side render of a blog post: <head> data + the full body HTML that used
// to be built in the browser by public/post-render.js (markup unchanged).
// Includes the small markdown-subset renderer the bot's plain-text bodies use.
const { esc, asset, postUrl, dateStr, FALLBACK_IMG, srcset } = require('../public/cards');
const { ORIGIN, abs, clipDesc } = require('./tour-page');
const path = require('path');
const { imageSize } = require('./imgsize');
const PUBLIC = path.join(__dirname, '..', 'public');

// Internal links in post bodies may be written in any of the site's URL forms
// (old "tour.html?slug=x", new "/tours/x/", bare "builder.html"). Emit clean
// root-absolute URLs; resolveTour maps a retired tour slug to its current one.
function cleanHref(href, resolveTour) {
  if (/^(https?:|mailto:|tel:|\/\/|#)/i.test(href)) return href;          // external, mailto:, #anchor
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return '#';                     // any other scheme (javascript: etc.) is dropped
  let h = href.replace(/^\/+/, '');
  let m;
  if ((m = h.match(/^tour\.html\?slug=([a-z0-9-]+)(#.*)?$/i))) return '/tours/' + (resolveTour ? resolveTour(m[1]) : m[1]) + '/' + (m[2] || '');
  if ((m = h.match(/^tours\/([a-z0-9-]+)\/?(#.*)?$/i))) return '/tours/' + (resolveTour ? resolveTour(m[1]) : m[1]) + '/' + (m[2] || '');
  if ((m = h.match(/^post\.html\?slug=([a-z0-9-]+)(#.*)?$/i))) return '/blog/' + m[1] + '/' + (m[2] || '');
  h = h.replace(/^tours\.html/, 'tours/').replace(/^blog\.html/, 'blog/').replace(/^index\.html/, '');
  return '/' + h;
}

// a portrait photo would fill a whole screen at column width, so it gets a narrower frame
const isTall = src => {
  if (/^(https?:)?\/\//.test(src)) return false;
  const s = imageSize(path.join(PUBLIC, src.replace(/^\/+/, '').split('?')[0]));
  return !!(s && s.height > s.width * 1.1);
};

function mdToHtml(src, resolveTour) {
  const inline = s => esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => `<a href="${cleanHref(href, resolveTour).replace(/"/g, '&quot;')}">${text}</a>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*(?![*\w])/g, '$1<em>$2</em>');
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  let html = '', list = null, table = null, firstPara = true;
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  const openList = tag => { if (list !== tag) { closeList(); html += `<${tag}>`; list = tag; } };
  // Markdown pipe table: | a | b |, an optional |---|---| line makes the first row the header.
  // Each cell carries its column name (data-label) so a phone can show rows as small cards.
  const cells = row => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const closeTable = () => {
    if (!table) return;
    const rows = table; table = null;
    const sep = rows.length > 1 && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(rows[1]);
    const head = sep ? cells(rows[0]) : null;
    const body = rows.slice(sep ? 2 : 0).map(cells);
    const n = Math.max(head ? head.length : 0, ...body.map(r => r.length));
    html += `<div class="table-wrap"><table class="cols-${n}">`;
    if (head) html += `<thead><tr>${head.map(h => `<th scope="col">${inline(h)}</th>`).join('')}</tr></thead>`;
    html += '<tbody>' + body.map(r => '<tr>' + r.map((c, i) => `<td${head && head[i] ? ` data-label="${esc(head[i].replace(/\*/g, ''))}"` : ''}>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('|')) { closeList(); (table = table || []).push(line); continue; }
    closeTable();
    if (!line) { closeList(); continue; }
    let m;
    if (line.startsWith('## ')) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>`; }
    else if (line.startsWith('### ')) { closeList(); html += `<h3>${inline(line.slice(4))}</h3>`; }
    else if (line.startsWith('> ')) { closeList(); html += `<blockquote>${inline(line.slice(2))}</blockquote>`; }
    else if (line.startsWith('- ')) { openList('ul'); html += `<li>${inline(line.slice(2))}</li>`; }
    else if ((m = line.match(/^\d+\.\s+(.*)$/))) { openList('ol'); html += `<li>${inline(m[1])}</li>`; }
    else if ((m = line.match(/^\[img:([^|\]]+)(?:\|([^\]]*))?\]$/))) { closeList(); const s = m[1].trim(); html += `<figure${isTall(s) ? ' class="tall"' : ''}><img loading="lazy" src="${esc(asset(s))}"${srcset(s, '(max-width:760px) 100vw, 720px')} alt="${esc(m[2] || '')}">${m[2] ? `<figcaption>${esc(m[2])}</figcaption>` : ''}</figure>`; }
    else if ((m = line.match(/^\[tip:([^|\]]+)\|([^\]]*)\]$/))) { closeList(); html += `<div class="tipbox"><b>${esc(m[1])}</b><p>${inline(m[2])}</p></div>`; }
    else { closeList(); html += `<p${firstPara ? ' class="lead"' : ''}>${inline(line)}</p>`; firstPara = false; }
  }
  closeTable();
  closeList();
  return html;
}

// brand suffix only while the whole title stays within 60 characters
const postTitle = title => (title + ' | Azat Tours').length <= 60 ? title + ' | Azat Tours' : title;
// optional FAQ block: [{ q, a }] (set from Markdown frontmatter)
const postFaqs = p => (Array.isArray(p.faq) ? p.faq : []).filter(f => f && f.q && f.a);

function postMeta(p) {
  // seoTitle / description: optional search-only wording; the H1 and the blog card keep title / excerpt
  const desc = clipDesc(p.description || p.excerpt || p.body || '');
  const url = ORIGIN + postUrl(p.slug);
  const image = abs(p.cover || '');
  const org = { '@type': 'Organization', '@id': ORIGIN + '/#organization', name: 'Azat Tours', url: ORIGIN + '/', logo: { '@type': 'ImageObject', url: ORIGIN + '/icon-512.png' } };
  // every article is written by the founder (content/posts.json author: "Azat, founder & guide")
  const author = { '@type': 'Person', name: 'Azat', jobTitle: 'Founder and guide', url: ORIGIN + '/about.html', worksFor: { '@id': ORIGIN + '/#organization' } };
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: p.title, description: desc, image: image || undefined,
      datePublished: p.date || undefined, dateModified: p.updated || p.updatedAt || p.date || undefined,
      author, publisher: org, mainEntityOfPage: url, inLanguage: 'en'
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: ORIGIN + '/blog/' },
        { '@type': 'ListItem', position: 3, name: p.title, item: url }
      ]
    }
  ];
  const faqs = postFaqs(p);
  if (faqs.length) jsonld.push({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
  });
  return { title: postTitle(p.seoTitle || p.title), desc, url, image, ogType: 'article', jsonld };
}

function postBody(p, resolveTour) {
  const words = String(p.body).trim().split(/\s+/).length;
  const readTime = Math.max(1, Math.round(words / 200)) + ' min read';
  const cover = asset(p.cover || FALLBACK_IMG);
  const coverAlt = esc(p.cover_alt || p.title);
  const faqs = postFaqs(p);

  const gallery = (p.images || []).length ? `
    <figure style="margin-top:40px"><div class="gallery" style="margin:0">
      ${p.images.map((src, i) => `<a href="${asset(src)}" target="_blank" rel="noopener" class="${i === 0 ? 'w2' : ''}"><img loading="lazy" src="${asset(src)}"${srcset(src, i === 0 ? '(max-width:680px) 100vw, 590px' : '(max-width:680px) 50vw, 290px')} alt="${esc(p.title)} photo ${i + 1}"></a>`).join('')}
    </div></figure>` : '';

  const faqHTML = faqs.length ? `
      <h2>Common questions</h2>
      ${faqs.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}` : '';

  return `
    <section class="article-hero">
      <div class="bg"><img src="${cover}"${srcset(cover, '100vw', [800, 1280, 1600])} fetchpriority="high" alt="${coverAlt}"></div>
      <div class="wrap">
        <p class="crumb"><a href="/">Home</a> / <a href="/blog/">Blog</a> / ${esc(p.category)}</p>
        <span class="tag">${esc(p.category)}</span>
        <h1>${esc(p.title)}</h1>
        <div class="byline">
          ${p.authorImg ? `<img src="${asset(p.authorImg)}" alt="${esc(p.author)}">` : ''}
          <span>By ${esc(p.author)}</span><span class="dot"></span><span>${dateStr(p.date)}</span><span class="dot"></span><span>${readTime}</span>
        </div>
      </div>
    </section>

    <article class="article">
      ${mdToHtml(p.body, resolveTour)}
      ${faqHTML}
      ${gallery}
      <div class="sell-box">
        <div class="im"><img loading="lazy" src="${cover}" alt=""></div>
        <div class="bd">
          <p class="eyebrow">Inspired?</p>
          <h3>Turn this into a real trip</h3>
          <p>Build your Kyrgyzstan adventure in 5 visual steps and a local expert sends a tailored plan within 24 hours. Free, no prepayment.</p>
          <div class="btns">
            <a href="/builder.html" class="btn btn-primary">Build my trip</a>
            <a href="/tours/" class="btn btn-ghost" style="border-color:rgba(255,255,255,.4)">Browse tours</a>
          </div>
        </div>
      </div>
    </article>

    <div class="article-foot">
      <a href="/blog/">← All articles</a>
      <a href="https://wa.me/996502888001?text=Hi%20Azat%20Tours!%20I%20read%20your%20article%20and%20have%20a%20question." target="_blank" rel="noopener">Ask us on WhatsApp</a>
    </div>`;
}

module.exports = { mdToHtml, cleanHref, postTitle, postMeta, postBody };
