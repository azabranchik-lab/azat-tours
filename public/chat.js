// On-site chat widget. Visitor messages -> /api/chat -> owner's Telegram.
// Owner replies in Telegram -> stored -> widget polls and shows them.
(function () {
  const WA = "https://wa.me/996222222011?text=Hi%20Azat%20Tours!%20I%20have%20a%20question.";
  const KEY = 'alatoo_chat_sid';
  let sid = localStorage.getItem(KEY);
  if (!sid) { sid = 'c' + Math.abs(Date.now() ^ (Math.floor(performance.now() * 1000))).toString(36) + Math.floor(performance.now()).toString(36); localStorage.setItem(KEY, sid); }
  let askedEmail = false, lastCount = 0, pollTimer = null;

  // hide the standalone WhatsApp float so we have one clean entry point
  document.querySelectorAll('.float-wa').forEach(el => el.style.display = 'none');

  const fab = document.createElement('button');
  fab.className = 'chat-fab'; fab.setAttribute('aria-label', 'Chat with us');
  fab.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Zm3 6h10v-2H7v2Zm0 4h7v-2H7v2Z"/></svg><span class="badge" style="display:none">1</span>';
  document.body.appendChild(fab);

  // proactive nudge: a one-line note from the founder, shown once per visitor
  const NUDGE_KEY = 'alatoo_chat_nudge_seen';
  const nudge = document.createElement('div');
  nudge.className = 'chat-nudge';
  nudge.innerHTML = `
    <button class="chat-nudge-x" aria-label="Dismiss">&times;</button>
    <div class="chat-nudge-av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg></div>
    <div class="chat-nudge-text"><b>Azat</b><span>Hi, I'm Azat. Questions about dates, routes or prices? Ask me right here, I'll reply personally.</span></div>`;
  document.body.appendChild(nudge);

  const panel = document.createElement('div');
  panel.className = 'chat-panel';
  panel.innerHTML = `
    <div class="chat-head">
      <div class="av"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m2 20 6.5-12L13 17l3-5 6 8Z"/><path d="m8.5 8 2.2 4"/></svg></div>
      <div><b>Chat with Azat Tours</b><span>Local experts · usually reply in a few hours</span></div>
      <button class="x" aria-label="Close">&times;</button>
    </div>
    <div class="chat-body" id="chatBody"></div>
    <div class="chat-email" id="chatEmail" style="display:none">
      <input type="email" id="chatEmailInput" placeholder="Your email (so we can reply if you leave)">
      <button id="chatEmailSave">Save</button>
    </div>
    <a class="chat-wa" href="${WA}" target="_blank" rel="noopener"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4V6a1 1 0 0 1 1-1Z"/></svg> Prefer WhatsApp? Message us</a>
    <div class="chat-input">
      <input type="text" id="chatText" placeholder="Type your question…" autocomplete="off">
      <button id="chatSend" aria-label="Send"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 15-7-6 14-2.5-6.5Z"/></svg></button>
    </div>`;
  document.body.appendChild(panel);

  const body = panel.querySelector('#chatBody');
  const input = panel.querySelector('#chatText');
  const badge = fab.querySelector('.badge');

  function bubble(from, text) {
    const d = document.createElement('div');
    d.className = 'chat-msg ' + from;
    d.textContent = text;
    body.appendChild(d); body.scrollTop = body.scrollHeight;
  }
  function greet() {
    if (!body.childElementCount) bubble('owner', 'Hi! Ask us anything about tours, dates, visas or safety, a local expert will reply here. What can we help with?');
  }
  function open() { dismissNudge(); panel.classList.add('open'); badge.style.display = 'none'; greet(); input.focus(); startPoll(); render(); }
  function close() { panel.classList.remove('open'); }

  fab.onclick = () => panel.classList.contains('open') ? close() : open();
  panel.querySelector('.x').onclick = close;

  // nudge behaviour: appear once after a short delay; opening chat or dismissing remembers it
  function showNudge() { if (localStorage.getItem(NUDGE_KEY)) return; nudge.classList.add('show'); fab.classList.add('nudging'); }
  function dismissNudge() { nudge.classList.remove('show'); fab.classList.remove('nudging'); localStorage.setItem(NUDGE_KEY, '1'); }
  nudge.onclick = () => { dismissNudge(); open(); };
  nudge.querySelector('.chat-nudge-x').onclick = (e) => { e.stopPropagation(); dismissNudge(); };
  setTimeout(() => {
    showNudge();
    if (!nudge.classList.contains('show')) return;
    // self-dismiss: don't sit on top of content until the user hunts the ×
    setTimeout(() => { if (nudge.classList.contains('show')) dismissNudge(); }, 8000);
    const y0 = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - y0) > 400) {
        window.removeEventListener('scroll', onScroll);
        if (nudge.classList.contains('show')) dismissNudge();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }, 3500);

  // keep the chat button clear of form submit areas (it covered Send buttons on 375px)
  const leadForms = document.querySelectorAll('form');
  if (leadForms.length && 'IntersectionObserver' in window) {
    const inView = new Set();
    const syncFab = () => fab.classList.toggle('fab-hidden', inView.size > 0 && !panel.classList.contains('open'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => en.isIntersecting ? inView.add(en.target) : inView.delete(en.target));
      syncFab();
    });
    leadForms.forEach((f) => io.observe(f));
    panel.addEventListener('transitionend', syncFab);
  }

  async function render() {
    try {
      const r = await fetch('/api/chat?sid=' + encodeURIComponent(sid));
      const j = await r.json();
      const msgs = (j.messages || []);
      // re-render fully (simple + reliable)
      body.innerHTML = '';
      greet();
      msgs.forEach(m => bubble(m.from === 'owner' ? 'owner' : 'user', m.text));
      // unread badge when closed
      if (!panel.classList.contains('open') && msgs.length > lastCount) {
        const newOwner = msgs.slice(lastCount).filter(m => m.from === 'owner').length;
        if (newOwner) { badge.textContent = newOwner; badge.style.display = 'grid'; }
      }
      lastCount = msgs.length;
    } catch (e) { /* server offline: stay quiet */ }
  }
  function startPoll() { if (!pollTimer) pollTimer = setInterval(render, 4000); }

  async function send(text) {
    bubble('user', text);
    try {
      await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid, text, email: localStorage.getItem('alatoo_chat_email') || '' }) });
    } catch (e) { bubble('sys', 'Couldn’t send, please try WhatsApp instead.'); }
    if (!askedEmail && !localStorage.getItem('alatoo_chat_email')) {
      askedEmail = true;
      panel.querySelector('#chatEmail').style.display = 'flex';
    }
    setTimeout(render, 600);
  }

  panel.querySelector('#chatSend').onclick = doSend;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
  function doSend() { const t = input.value.trim(); if (!t) return; input.value = ''; send(t); }

  panel.querySelector('#chatEmailSave').onclick = () => {
    const v = panel.querySelector('#chatEmailInput').value.trim();
    if (v) { localStorage.setItem('alatoo_chat_email', v); fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid, text: '(left email: ' + v + ')', email: v }) }); }
    panel.querySelector('#chatEmail').style.display = 'none';
    bubble('sys', v ? 'Thanks! We’ll reply here and by email.' : '');
  };

  // light background polling so badge updates even before first open
  startPoll();
})();
