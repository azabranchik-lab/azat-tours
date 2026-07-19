// On-site chat widget. Visitor messages -> /api/chat -> owner's Telegram.
// Owner replies in Telegram -> stored -> widget polls and shows them.
(function () {
  const WA = "https://wa.me/996222222011?text=Hi%20Azat%20Tours!%20I%20have%20a%20question.";
  const KEY = 'alatoo_chat_sid';
  let sid = localStorage.getItem(KEY);
  if (!sid) { sid = 'c' + Math.abs(Date.now() ^ (Math.floor(performance.now() * 1000))).toString(36) + Math.floor(performance.now()).toString(36); localStorage.setItem(KEY, sid); }
  let askedEmail = false, lastCount = 0, pollTimer = null, pollRate = 0;

  const POLL_OPEN = 4000, POLL_IDLE = 20000;
  const mq = window.matchMedia('(max-width:680px)');
  const isMobile = () => mq.matches;
  const vvp = window.visualViewport;
  let vvBound = false, histPushed = false, popPending = false;
  const notices = [];   // client-side warnings that must survive a full re-render
  const pending = [];   // messages that never reached the server, kept visible for the same reason

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
  const emailInput = panel.querySelector('#chatEmailInput');
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
  // --- mobile sheet plumbing: scroll lock, keyboard-aware sizing, back gesture ---
  // NOTE: `body` above is #chatBody, not document.body. Always write document.body explicitly.
  // The page keeps its scroll position: nothing is taken out of flow, so there is nothing to
  // save and restore. Touch dragging is stopped by touch-action and the touchmove barrier below.
  function lockScroll() {
    if (!isMobile()) return;
    document.body.classList.add('chat-locked');
  }
  function unlockScroll() {
    document.body.classList.remove('chat-locked');
  }
  // iOS anchors position:fixed to the layout viewport, which the keyboard doesn't shrink, so the
  // composer ends up behind it and Safari scrolls the page to reveal it. Pinning the sheet to the
  // visual viewport puts the composer in view already, leaving Safari nothing to scroll.
  // the keyboard cannot be up unless one of the two fields holds focus; checking focus rather
  // than size alone is what stops the sheet from chasing the keyboard's closing animation
  const typing = () => document.activeElement === input || document.activeElement === emailInput;
  function unpin() {
    panel.classList.remove('vv');
    panel.style.removeProperty('--chat-h');
    panel.style.removeProperty('--chat-top');
  }
  function syncViewport() {
    if (!vvp || !isMobile() || !panel.classList.contains('open')) return;
    // pin to the visual viewport ONLY while the keyboard is really up. iOS fires viewport events
    // for rubber-band scrolling, for the collapsing URL bar and all through the keyboard's
    // dismiss animation; following those made the sheet drift and flicker.
    if (!typing() || window.innerHeight - vvp.height <= 120) { unpin(); return; }
    panel.style.setProperty('--chat-h', vvp.height + 'px');
    panel.style.setProperty('--chat-top', vvp.offsetTop + 'px');
    panel.classList.add('vv');
    // only follow the newest message if the reader is already at the bottom, otherwise the
    // keyboard opening would yank them away from the older reply they scrolled up to read
    if (body.scrollHeight - body.scrollTop - body.clientHeight < 40) body.scrollTop = body.scrollHeight;
  }
  function bindViewport() {
    if (!vvp || vvBound) return;
    vvp.addEventListener('resize', syncViewport);   // resize only: 'scroll' is what made it drift
    vvBound = true;
  }
  function unbindViewport() {
    if (vvp && vvBound) {
      vvp.removeEventListener('resize', syncViewport);
      vvBound = false;
    }
    panel.classList.remove('vv');
    panel.style.removeProperty('--chat-h');
    panel.style.removeProperty('--chat-top');
  }
  function pushHistory() {
    if (!isMobile() || histPushed) return;
    try { history.pushState({ chat: 1 }, ''); histPushed = true; } catch (e) { /* no history access */ }
  }

  function open() {
    if (panel.classList.contains('open')) return;   // reachable from both the fab and the nudge
    dismissNudge();
    lockScroll();
    panel.classList.add('open');
    badge.style.display = 'none';
    greet();
    bindViewport(); syncViewport();
    pushHistory();
    // owner's call: on the phone the keyboard must wait for a deliberate tap on the field,
    // so the sheet opens showing the conversation. Desktop keeps the ready-to-type cursor.
    if (!isMobile()) input.focus();
    startPoll(POLL_OPEN); render();
  }
  function close(fromPop) {
    if (!panel.classList.contains('open')) return;
    panel.classList.remove('open');
    input.blur();
    unbindViewport();
    unlockScroll();
    startPoll(POLL_IDLE);
    if (!fromPop && histPushed) { histPushed = false; popPending = true; history.back(); }
  }

  fab.onclick = () => panel.classList.contains('open') ? close() : open();
  panel.querySelector('.x').onclick = () => close();

  window.addEventListener('popstate', () => {
    // our own close() already popped this entry; without the guard a close-then-reopen
    // within the same frame would let the late event slam the reopened sheet shut
    if (popPending) { popPending = false; return; }
    if (panel.classList.contains('open')) { histPushed = false; close(true); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) close();
  });
  // rotating into tablet width must not strand the lock
  const onMq = e => { if (!e.matches && panel.classList.contains('open')) { unbindViewport(); unlockScroll(); } };
  // Safari 13 and older only have the deprecated addListener; calling addEventListener there
  // throws and would abort the rest of this file, leaving the widget without polling
  if (mq.addEventListener) mq.addEventListener('change', onMq);
  else if (mq.addListener) mq.addListener(onMq);
  // Only the transcript may move. CSS overscroll/touch-action covers modern iOS; this is the
  // barrier that holds on older Safari, where a drag started on the header or the composer
  // still rubber-bands the page underneath.
  panel.addEventListener('touchmove', e => {
    if (!isMobile() || !panel.classList.contains('open')) return;
    const inTranscript = body.contains(e.target) && body.scrollHeight > body.clientHeight;
    if (!inTranscript) e.preventDefault();
  }, { passive: false });
  // iOS fires the visualViewport resize after focus, hence the nudges
  [input, emailInput].forEach(el => {
    el.addEventListener('focus', () => { setTimeout(syncViewport, 60); setTimeout(syncViewport, 350); });
    // release the pin the moment focus leaves, before the keyboard starts animating away:
    // waiting even 120ms let the sheet resize to a mid-animation height and visibly collapse
    el.addEventListener('blur', unpin);
  });
  // focusout bubbles where blur does not, so this is the reliable net: after focus settles,
  // if neither field holds it the keyboard is on its way out and the sheet goes full height
  panel.addEventListener('focusout', () => setTimeout(() => { if (!typing()) unpin(); }, 0));

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
      // undelivered messages and their warning live only on the client, so the wipe above
      // would erase them: the visitor would read "it didn't send" with no message in sight
      pending.forEach(t => bubble('user', t));
      notices.forEach(t => bubble('sys', t));
      // unread badge when closed
      if (!panel.classList.contains('open') && msgs.length > lastCount) {
        const newOwner = msgs.slice(lastCount).filter(m => m.from === 'owner').length;
        if (newOwner) { badge.textContent = newOwner; badge.style.display = 'grid'; }
      }
      lastCount = msgs.length;
    } catch (e) { /* server offline: stay quiet */ }
  }
  // 4s while the chat is open, 20s in the background so the badge still arrives
  function startPoll(ms) {
    const want = ms || (panel.classList.contains('open') ? POLL_OPEN : POLL_IDLE);
    if (pollTimer && pollRate === want) return;
    clearInterval(pollTimer); pollRate = want;
    pollTimer = setInterval(() => { if (!document.hidden) render(); }, want);
  }
  // catch up on return to the tab, but only for visitors who actually have a conversation
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (lastCount > 0 || panel.classList.contains('open'))) render();
  });

  // which page the visitor is asking from, so the owner has context in Telegram
  function pageCtx() {
    const q = new URLSearchParams(location.search);
    return { page: location.pathname + location.search, pageTitle: document.title, slug: q.get('slug') || '' };
  }
  const FAIL = 'That message didn’t reach us. Please try again, or message us on WhatsApp.';
  const BUSY = 'You’ve sent several messages very quickly. Give it a few minutes, or message us on WhatsApp and we’ll pick it up there.';
  function notice(t) { if (!notices.includes(t)) { notices.push(t); bubble('sys', t); } }

  async function send(text) {
    bubble('user', text);
    let ok = false;
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ sid, text, email: localStorage.getItem('alatoo_chat_email') || '' }, pageCtx()))
      });
      let j = {}; try { j = await r.json(); } catch (e) { /* empty body */ }
      ok = r.ok && j.ok !== false;
      if (!ok) notice(r.status === 429 ? BUSY : FAIL);
    } catch (e) { notice(FAIL); }
    if (!ok) { pending.push(text); return; }
    notices.length = 0; pending.length = 0;
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
    if (v) { localStorage.setItem('alatoo_chat_email', v); fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ sid, text: '(left email: ' + v + ')', email: v }, pageCtx())) }); }
    panel.querySelector('#chatEmail').style.display = 'none';
    if (v) bubble('sys', 'Thanks! We’ll reply here and by email.');
  };

  // light background polling so badge updates even before first open
  startPoll(POLL_IDLE);
})();
