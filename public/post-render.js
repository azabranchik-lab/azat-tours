// Renders a blog post from window.POSTS based on ?slug=. Includes a small
// markdown-subset renderer so the bot can store plain text with simple markup.
(function () {
  const POSTS = window.POSTS || [];
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const p = slug ? (POSTS.find(x => x.slug === slug) || null) : POSTS[0];
  const root = document.getElementById('postRoot');
  if (!p) { root.innerHTML = '<div class="wrap" style="padding:160px 0 80px"><h1>Article not found</h1><p><a href="blog.html">← Back to the blog</a></p></div>'; return; }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')   // [text](url) links (internal tour links etc.)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // markdown-subset -> HTML
  function mdToHtml(src) {
    const lines = String(src).replace(/\r\n/g, '\n').split('\n');
    let html = '', list = null, firstPara = true;
    const closeList = () => { if (list) { html += '</ul>'; list = null; } };
    for (let raw of lines) {
      const line = raw.trim();
      if (!line) { closeList(); continue; }
      let m;
      if (line.startsWith('## ')) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>`; }
      else if (line.startsWith('### ')) { closeList(); html += `<h3>${inline(line.slice(4))}</h3>`; }
      else if (line.startsWith('> ')) { closeList(); html += `<blockquote>${inline(line.slice(2))}</blockquote>`; }
      else if (line.startsWith('- ')) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(line.slice(2))}</li>`; }
      else if ((m = line.match(/^\[img:([^|\]]+)(?:\|([^\]]*))?\]$/))) { closeList(); html += `<figure><img loading="lazy" src="${esc(m[1].trim())}" alt="${esc(m[2] || '')}">${m[2] ? `<figcaption>${esc(m[2])}</figcaption>` : ''}</figure>`; }
      else if ((m = line.match(/^\[tip:([^|\]]+)\|([^\]]*)\]$/))) { closeList(); html += `<div class="tipbox"><b>${esc(m[1])}</b><p>${inline(m[2])}</p></div>`; }
      else { closeList(); html += `<p${firstPara ? ' class="lead"' : ''}>${inline(line)}</p>`; firstPara = false; }
    }
    closeList();
    return html;
  }

  const words = String(p.body).trim().split(/\s+/).length;
  const readTime = Math.max(1, Math.round(words / 200)) + ' min read';
  const dateStr = p.date ? new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  document.title = `${p.title} | Azat Tours`; // shorter suffix keeps more titles ≤60

  // ---- per-post SEO: meta description, og tags, canonical, JSON-LD ----
  (function seo() {
    const desc = String(p.excerpt || p.body || '').replace(/\s+/g, ' ').trim().slice(0, 158);
    const pageUrl = 'https://azattours.com/post.html?slug=' + encodeURIComponent(p.slug);
    const setMeta = (attr, key, val) => {
      if (!val) return;
      let m = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute(attr, key); document.head.appendChild(m); }
      m.setAttribute('content', val);
    };
    setMeta('name', 'description', desc);
    setMeta('property', 'og:type', 'article');
    setMeta('property', 'og:title', document.title);
    setMeta('property', 'og:description', desc);
    const absUrl = u => u ? (/^https?:\/\//.test(u) ? u : 'https://azattours.com/' + String(u).replace(/^\/+/, '')) : '';
    setMeta('property', 'og:image', absUrl(p.cover || '')); // og:image must be absolute
    setMeta('name', 'twitter:card', 'summary_large_image');
    let canon = document.head.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
    canon.href = pageUrl;
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify([
      {
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: p.title, description: desc,
        image: p.cover || undefined,
        datePublished: p.date || undefined,
        author: { '@type': 'Person', name: p.author },
        publisher: { '@type': 'TravelAgency', name: 'Azat Tours Kyrgyzstan', url: 'https://azattours.com' },
        mainEntityOfPage: pageUrl
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://azattours.com/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://azattours.com/blog.html' },
          { '@type': 'ListItem', position: 3, name: p.title, item: pageUrl }
        ]
      }
    ]);
    // Skip if the server already rendered the JSON-LD (avoids a duplicate block).
    if (!document.head.querySelector('script[data-ssr]')) document.head.appendChild(ld);
  })();

  const gallery = (p.images || []).length ? `
    <figure style="margin-top:40px"><div class="gallery" style="margin:0">
      ${p.images.map((src, i) => `<a href="${src}" target="_blank" rel="noopener" class="${i === 0 ? 'w2' : ''}"><img loading="lazy" src="${src}" alt="${esc(p.title)} photo ${i + 1}"></a>`).join('')}
    </div></figure>` : '';

  root.innerHTML = `
    <section class="article-hero">
      <div class="bg"><img src="${p.cover || 'img/hero/hero-1-reflection-1400.jpg'}" alt="${esc(p.title)}"></div>
      <div class="wrap">
        <p class="crumb"><a href="index.html">Home</a> / <a href="blog.html">Blog</a> / ${esc(p.category)}</p>
        <span class="tag">${esc(p.category)}</span>
        <h1>${esc(p.title)}</h1>
        <div class="byline">
          ${p.authorImg ? `<img src="${p.authorImg}" alt="${esc(p.author)}">` : ''}
          <span>By ${esc(p.author)}</span><span class="dot"></span><span>${dateStr}</span><span class="dot"></span><span>${readTime}</span>
        </div>
      </div>
    </section>

    <article class="article">
      ${mdToHtml(p.body)}
      ${gallery}
      <div class="sell-box">
        <div class="im"><img loading="lazy" src="${p.cover}" alt=""></div>
        <div class="bd">
          <p class="eyebrow">Inspired?</p>
          <h3>Turn this into a real trip</h3>
          <p>Build your Kyrgyzstan adventure in 5 visual steps and a local expert sends a tailored plan within 24 hours. Free, no prepayment.</p>
          <div class="btns">
            <a href="builder.html" class="btn btn-primary">Build my trip</a>
            <a href="tours.html" class="btn btn-ghost" style="border-color:rgba(255,255,255,.4)">Browse tours</a>
          </div>
        </div>
      </div>
    </article>

    <div class="article-foot">
      <a href="blog.html">← All articles</a>
      <a href="https://wa.me/996222222011?text=Hi%20Azat%20Tours!%20I%20read%20your%20article%20and%20have%20a%20question." target="_blank" rel="noopener">Ask us on WhatsApp</a>
    </div>`;
})();
