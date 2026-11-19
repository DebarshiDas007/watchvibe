// WatchVibe Game Night: Draw the Movie, Movie Fibber and Who's the Impostor?
// Rooms live in Supabase Realtime (broadcast + presence), like Watch together: nothing is stored, friends join with a link.
// The longest-present player is the host: the host's device runs the game and sends the full game state to everyone.
// If the host leaves, the next player takes over from the last state. Drawings are sent as small batches of strokes.
// Uses globals from index.html: mediaDatabase, esc, showToast, currentUserSession, dcIsIndian, dcSimilar, ps, Track.

const GN = { code: null, ch: null, me: null, st: null, members: [], feed: [], strokes: [], strokesKey: '', out: [], tick: 0, flushT: 0,
  tool: { c: '#111111', w: 6, erase: false }, cur: null, rcur: null, canvas: null, ctx: null, wrap: null, sentFib: '', joinCode: '' };
const GN_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GN_COLORS = ['#111111', '#ffffff', '#9ca3af', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#92400e'];
const GN_SIZES = [3, 7, 14, 26];
const GN_MAX = 10;
const GN_GAMES = {
  draw: { name: 'Draw the Movie', min: 2, icon: 'fa-paintbrush', desc: 'One player draws a film. Everyone else races to type its name. Faster guesses score more.' },
  fib: { name: 'Movie Fibber', min: 3, icon: 'fa-masks-theater', desc: 'Everyone writes a fake plot for a real film. Spot the real plot and fool your friends with yours.' },
  imp: { name: "Who's the Impostor?", min: 3, icon: 'fa-user-secret', desc: 'Everyone gets the same film except one player, who gets a similar one. Give one-word clues, then vote out the impostor.' }
};

// ---------- identity, room, messages
function gnMe() {
  if (GN.me) return GN.me;
  let id = null; try { id = sessionStorage.getItem('gn_id'); } catch (e) {}
  if (!id) { id = Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('gn_id', id); } catch (e) {} }
  let name = ''; try { name = localStorage.getItem('gn_name') || ''; } catch (e) {}
  if (!name && typeof currentUserSession !== 'undefined' && currentUserSession && currentUserSession.name) name = String(currentUserSession.name).split(/\s+/)[0];
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  GN.me = { id, name: String(name || '').slice(0, 16), color: `hsl(${h % 360} 70% 60%)`, ts: 0 };
  return GN.me;
}
const gnNorm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
const gnRand = n => Math.floor(Math.random() * n);
function gnShuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = gnRand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function gnLink() { return `${location.origin}/?game=${GN.code}`; }
function gnPresent() { return GN.members.map(m => m.id); }
function gnIsHost() { return GN.members.length ? GN.members[0].id === gnMe().id : true; }
function gnName(u) { const m = GN.members.find(x => x.id === u); if (m) return m.name; const n = GN.st && GN.st.names && GN.st.names[u]; return n ? n.name : 'Player'; }
function gnColor(u) { const m = GN.members.find(x => x.id === u); if (m) return m.color; const n = GN.st && GN.st.names && GN.st.names[u]; return n ? n.color : '#888'; }
function gnSend(p) { if (GN.ch) GN.ch.send({ type: 'broadcast', event: 'g', payload: p }); }
function gnLeft(st) { return Math.max(0, Math.ceil(((st || GN.st || {}).deadline - Date.now()) / 1000)) || 0; }
function gnDeadline(st, sec) { st.deadline = Date.now() + sec * 1000; st.dur = sec * 1000; }
function gnCompact(m) { return { id: m.id, title: m.title, year: m.year, poster: m.poster, genres: (m.genres || []).filter(g => !/^(Trending|Cinema|Series|Movie)$/i.test(g)).slice(0, 3) }; }

// host: change the state and send it to everyone (the time left travels as a duration, so clocks that differ do not matter)
function gnPack(st) { const o = JSON.parse(JSON.stringify(st)); o.leftMs = st.deadline ? Math.max(0, st.deadline - Date.now()) : null; delete o.deadline; return o; }
function gnUpdate(fn) { const st = GN.st; if (!st) return; fn(st); st.v = (st.v || 0) + 1; gnSend({ t: 'st', st: gnPack(st) }); gnAfterState(); }
function gnLobbyState() { return { v: 1, phase: 'lobby', game: 'draw', settings: { rounds: 3, drawSec: 80, pool: 'mix', fibRounds: 4, impRounds: 3, impLaps: 2 }, names: {}, scores: {}, total: {} }; }

function openGames(code) {
  let r = document.getElementById('gnRoot');
  if (!r) { r = document.createElement('div'); r.id = 'gnRoot'; r.className = 'fixed inset-0 z-[85] flex flex-col bg-[#0B0B0F] text-white'; document.body.appendChild(r); }
  document.documentElement.style.overflow = 'hidden';
  if (code) GN.joinCode = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  gnRender(true);
  if (GN.joinCode && !GN.code && gnMe().name) gnJoin(GN.joinCode, false);
}
function closeGames() {
  gnLeave(true);
  const r = document.getElementById('gnRoot'); if (r) r.remove();
  document.documentElement.style.overflow = '';
  GN.wrap = null; GN.canvas = null; GN.ctx = null;
  if (new URLSearchParams(location.search).get('game')) history.replaceState(null, '', location.pathname);
}
function gnCreate() { if (!gnTakeName()) return; let c = ''; for (let i = 0; i < 5; i++) c += GN_ALPHA[gnRand(GN_ALPHA.length)]; gnJoin(c, true); }
function gnJoinTyped() {
  if (!gnTakeName()) return;
  const v = ((document.getElementById('gnCodeInput') || {}).value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v.length < 4) { showToast('Type the room code your friend sent you'); return; }
  gnJoin(v, false);
}
function gnTakeName() {
  const el = document.getElementById('gnNameInput'); const v = String((el && el.value) || gnMe().name || '').trim().slice(0, 16);
  if (!v) { showToast('Type your name first'); if (el) el.focus(); return false; }
  gnMe().name = v; try { localStorage.setItem('gn_name', v); } catch (e) {}
  return true;
}
function gnRename() {
  const el = document.getElementById('gnRenameInput'); const v = String((el && el.value) || '').trim().slice(0, 16); if (!v) return;
  gnMe().name = v; try { localStorage.setItem('gn_name', v); } catch (e) {}
  if (GN.ch) GN.ch.track({ id: gnMe().id, name: v, color: gnMe().color, ts: gnMe().ts });
  showToast('Name changed');
}
function gnJoin(code, create) {
  const sb = window.supabaseClient;
  if (!sb || !sb.channel) { showToast('Live rooms are not available right now. Try again in a moment.'); return; }
  if (GN.ch) gnLeave(true);
  const me = gnMe();
  GN.code = code; GN.members = []; GN.feed = []; GN.strokes = []; GN.strokesKey = ''; GN.out = []; GN.st = create ? gnLobbyState() : null;
  history.replaceState(null, '', '?game=' + code);
  const ch = sb.channel('gn:' + code, { config: { broadcast: { self: true }, presence: { key: me.id } } });
  GN.ch = ch;
  ch.on('broadcast', { event: 'g' }, m => gnOn(m.payload))
    .on('presence', { event: 'sync' }, () => {
      const s = ch.presenceState();
      GN.members = Object.values(s).map(a => a[0]).filter(Boolean).sort((x, y) => (x.ts - y.ts) || String(x.id).localeCompare(String(y.id)));
      if (GN.members.length > GN_MAX && GN.members.findIndex(m => m.id === me.id) >= GN_MAX) { showToast(`This room is full (${GN_MAX} players).`); closeGames(); return; }
      gnMembersChanged();
    })
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        me.ts = me.ts || Date.now();
        await ch.track({ id: me.id, name: me.name, color: me.color, ts: me.ts });
        if (!create) { gnSend({ t: 'req', from: me.id }); setTimeout(() => { if (!GN.st && gnIsHost()) { GN.st = gnLobbyState(); gnMembersChanged(); gnRender(true); } }, 2500); }
        gnSys(create ? 'Room created. Send the link to your friends.' : 'You joined the room.');
        try { Track.event('game_room', { c: create ? 1 : 0 }); } catch (e) {}
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') showToast('Connection problem. Check your internet and try again.');
    });
  clearInterval(GN.tick); GN.tick = setInterval(gnTick, 250);
  clearInterval(GN.flushT); GN.flushT = setInterval(gnFlush, 80);
  gnRender(true);
}
function gnLeave(silent) {
  clearInterval(GN.tick); clearInterval(GN.flushT); GN.tick = 0; GN.flushT = 0;
  if (GN.ch && window.supabaseClient) { try { window.supabaseClient.removeChannel(GN.ch); } catch (e) {} }
  GN.ch = null; GN.code = null; GN.st = null; GN.members = []; GN.feed = []; GN.strokes = [];
  if (!silent) gnRender(true);
}
function gnMembersChanged() {
  if (GN.st && gnIsHost()) {
    const names = GN.st.names || {}; let changed = false;
    GN.members.forEach(m => { const n = names[m.id]; if (!n || n.name !== m.name) { names[m.id] = { name: m.name, color: m.color }; changed = true; } });
    if (changed) gnUpdate(st => { st.names = names; });
  }
  gnRenderPlayers(); gnRenderTop();
  if (GN.st && GN.st.phase === 'lobby') gnRenderStage();
}

// ---------- receiving
function gnOn(p) {
  if (!p || !p.t) return;
  const me = gnMe();
  switch (p.t) {
    case 'req':
      if (GN.st && gnIsHost() && p.from !== me.id) {
        gnSend({ t: 'st', st: gnPack(GN.st), to: p.from });
        if (GN.strokes.length) gnSend({ t: 'strokes', to: p.from, key: GN.strokesKey, s: GN.strokes });
      }
      break;
    case 'st': {
      if (p.to && p.to !== me.id) break;
      const cur = GN.st;
      if (cur && !p.to && (p.st.v || 0) <= (cur.v || 0)) break;   // older than what we have (includes the host's own echo)
      const st = p.st; st.deadline = st.leftMs != null ? Date.now() + st.leftMs : null; delete st.leftMs;
      GN.st = st; gnAfterState(); break;
    }
    case 'strokes': if (p.to === me.id) { GN.strokes = p.s || []; GN.strokesKey = p.key; gnRedraw(); } break;
    case 'draw': if (p.u !== me.id) gnApplyOps(p.ops || []); break;
    case 'chat': {
      if (p.g) { const d = GN.st && GN.st.d; const ok = d && (d.drawer === me.id || (d.guessed && d.guessed[me.id] != null)); if (!ok) break; }
      gnFeedAdd({ k: p.g ? 'gchat' : 'chat', u: p.u, text: p.text }); break;
    }
    case 'sys': gnFeedAdd({ k: p.ok ? 'ok' : 'sys', text: p.text }); break;
    case 'close': if (p.to === me.id) gnFeedAdd({ k: 'close', text: `"${p.text}" is very close!` }); break;
    case 'guess': if (gnIsHost()) gdGuess(p.u, p.text); break;
    case 'act': if (gnIsHost()) gnAct(p); break;
  }
}
function gnAfterState() {
  const st = GN.st; if (!st) return;
  const key = st.phase === 'play' && st.game === 'draw' && st.d ? st.d.round + ':' + st.d.turn : '';
  if (key !== GN.strokesKey) { GN.strokes = []; GN.rcur = null; GN.cur = null; GN.strokesKey = key; gnRedraw(); }
  gnRenderPlayers(); gnRenderTop(); gnRenderStage(); gnRenderChatInput();
}
function gnSys(text, ok) { gnFeedAdd({ k: ok ? 'ok' : 'sys', text }); }
function gnBroadcastSys(text, ok) { gnSend({ t: 'sys', text, ok: !!ok }); }

// ---------- host: actions from players
function gnAct(p) {
  const st = GN.st; if (!st || st.phase !== 'play') return;
  if (st.game === 'draw' && p.a === 'pick') gdPick(p.u, p.i);
  if (st.game === 'fib') { if (p.a === 'fib') gfFib(p.u, p.text); if (p.a === 'vote') gfVote(p.u, p.o); }
  if (st.game === 'imp') { if (p.a === 'clue') giClue(p.u, p.text); if (p.a === 'vote') giVote(p.u, p.target); if (p.a === 'guess') giGuess(p.u, p.id); }
}
function gnDo(a, extra) { gnSend(Object.assign({ t: 'act', u: gnMe().id, a }, extra || {})); }

// host lobby controls
function gnSetGame(g) { if (gnIsHost() && GN.st && GN.st.phase !== 'play') gnUpdate(st => { st.game = g; st.phase = 'lobby'; }); }
function gnSetting(k, v) { if (gnIsHost() && GN.st) gnUpdate(st => { st.settings[k] = isNaN(Number(v)) ? v : Number(v); }); }
function gnStart(g) {
  if (!gnIsHost() || !GN.st) return;
  const game = g || GN.st.game, need = GN_GAMES[game].min, n = GN.members.length;
  if (n < need) { showToast(`${GN_GAMES[game].name} needs at least ${need} players. Invite ${need - n} more.`); return; }
  gnUpdate(st => {
    st.game = game; st.phase = 'play'; st.scores = {}; gnPresent().forEach(u => { st.scores[u] = 0; });
    delete st.d; delete st.f; delete st.i;
    if (game === 'draw') gdInit(st); else if (game === 'fib') gfInit(st); else giInit(st);
  });
  gnBroadcastSys(`${GN_GAMES[game].name} has started. Good luck!`);
  try { Track.event('game_start', { g: game, n }); } catch (e) {}
}
function gnEnd(st) {
  st.phase = 'end'; st.deadline = null;
  Object.entries(st.scores || {}).forEach(([u, v]) => { st.total[u] = (st.total[u] || 0) + v; });
}
function gnToLobby() { if (gnIsHost()) gnUpdate(st => { st.phase = 'lobby'; delete st.d; delete st.f; delete st.i; }); }
function gnAddScore(st, u, pts) { st.scores[u] = (st.scores[u] || 0) + pts; }

// host clock
function gnTick() {
  const t = document.getElementById('gnTimer'); const st = GN.st;
  if (t) { const l = st && st.deadline ? gnLeft(st) : null; t.textContent = l == null ? '' : l + 's'; t.classList.toggle('text-rose-300', l != null && l <= 10); }
  const bar = document.getElementById('gnTimeBar');
  if (bar && st && st.deadline && st.dur) bar.style.width = Math.max(0, Math.min(100, (st.deadline - Date.now()) / st.dur * 100)) + '%';
  if (!st || st.phase !== 'play' || !gnIsHost()) return;
  if (st.game === 'draw') gdTick(st); else if (st.game === 'fib') gfTick(st); else giTick(st);
}

// ================= DRAW THE MOVIE =================
function gnPools() {
  const v = m => m.totalVotes || 0, ok = m => m.type === 'Movie' && m.title && m.poster && m.title.length <= 24 && !/[:;]/.test(m.title);
  return { hw: mediaDatabase.filter(m => ok(m) && m.language === 'en' && !dcIsIndian(m) && v(m) >= 4000), ind: mediaDatabase.filter(m => ok(m) && dcIsIndian(m) && v(m) >= 300) };
}
function gdChoices(st) {
  const P = gnPools(), used = new Set(st.d.used), pick = (arr, n) => gnShuffle(arr.filter(m => !used.has(m.id))).slice(0, n);
  const mode = st.settings.pool;
  let out = mode === 'hw' ? pick(P.hw, 3) : mode === 'in' ? pick(P.ind, 3) : gnShuffle(pick(P.hw, 2).concat(pick(P.ind, 1)));
  return out.map(gnCompact);
}
function gdInit(st) {
  st.d = { round: 1, turn: 0, order: gnPresent(), used: [], phase: 'choose', drawer: null, choices: [], word: null, reveal: [], guessed: {}, gain: {} };
  gdBeginTurn(st);
}
function gdBeginTurn(st) {
  const d = st.d, here = new Set(gnPresent());
  // add people who joined since, then skip anyone who has left
  gnPresent().forEach(u => { if (!d.order.includes(u)) { d.order.push(u); st.scores[u] = st.scores[u] || 0; } });
  while (true) {
    if (d.turn >= d.order.length) { d.round++; d.turn = 0; }
    if (d.round > st.settings.rounds) { gnEnd(st); return; }
    if (here.has(d.order[d.turn])) break;
    d.turn++;
    if (!d.order.some(u => here.has(u))) { gnEnd(st); return; }
  }
  d.drawer = d.order[d.turn]; d.phase = 'choose'; d.word = null; d.reveal = []; d.guessed = {}; d.gain = {};
  d.choices = gdChoices(st); gnDeadline(st, 15);
}
function gdPick(u, i) {
  const st = GN.st, d = st && st.d; if (!d || d.phase !== 'choose' || u !== d.drawer) return;
  gnUpdate(st => { gdStartDraw(st, i); });
}
function gdStartDraw(st, i) {
  const d = st.d, w = d.choices[Math.max(0, Math.min(d.choices.length - 1, i | 0))]; if (!w) { gdBeginTurn(st); return; }
  d.word = w; d.used.push(w.id); d.phase = 'draw'; d.reveal = []; d.guessed = {}; d.gain = {};
  gnDeadline(st, st.settings.drawSec);
}
function gdLetters(title) { const idx = []; String(title).split('').forEach((c, i) => { if (/[A-Za-z0-9À-ɏ]/.test(c)) idx.push(i); }); return idx; }
function gdTick(st) {
  const d = st.d; if (!d) return;
  const now = Date.now(), here = new Set(gnPresent());
  if (d.phase === 'choose') {
    if (!here.has(d.drawer)) { gnUpdate(st => { d.turn++; gdBeginTurn(st); }); return; }
    if (now > st.deadline) gnUpdate(st => gdStartDraw(st, gnRand(st.d.choices.length)));
    return;
  }
  if (d.phase === 'draw') {
    const guessers = [...here].filter(u => u !== d.drawer);
    const allIn = guessers.length > 0 && guessers.every(u => d.guessed[u] != null);
    if (now > st.deadline || allIn || !here.has(d.drawer)) { gnUpdate(st => gdReveal(st)); return; }
    const frac = 1 - (st.deadline - now) / st.dur, L = gdLetters(d.word.title), want = frac >= 0.75 ? Math.ceil(L.length * 0.35) : frac >= 0.5 ? Math.ceil(L.length * 0.18) : 0;
    const target = Math.min(want, Math.max(0, L.length - 2));
    if (d.reveal.length < target) gnUpdate(st => { const free = L.filter(i => !st.d.reveal.includes(i)); while (st.d.reveal.length < target && free.length) st.d.reveal.push(free.splice(gnRand(free.length), 1)[0]); });
    return;
  }
  if (d.phase === 'reveal' && now > st.deadline) gnUpdate(st => { st.d.turn++; gdBeginTurn(st); });
}
function gdReveal(st) {
  const d = st.d, n = Object.keys(d.guessed).length;
  if (n) { const pts = Math.min(400, 60 * n); d.gain[d.drawer] = pts; gnAddScore(st, d.drawer, pts); }
  d.phase = 'reveal'; gnDeadline(st, 6);
}
function gdGuess(u, text) {
  const st = GN.st; if (!st) return;
  const d = st.phase === 'play' && st.game === 'draw' ? st.d : null;
  const t = String(text || '').trim().slice(0, 80); if (!t) return;
  if (!d || d.phase !== 'draw' || !d.word) { gnSend({ t: 'chat', u, text: t }); return; }
  if (u === d.drawer || d.guessed[u] != null) { gnSend({ t: 'chat', u, text: t, g: true }); return; }
  const g = gnNorm(t), full = gnNorm(d.word.title), noThe = full.replace(/^the/, '');
  if (g && (g === full || g === noThe)) {
    gnUpdate(st => {
      const d = st.d, left = Math.max(0, st.deadline - Date.now()) / st.dur, order = Object.keys(d.guessed).length;
      const pts = Math.round(100 + 300 * left) + (order === 0 ? 50 : 0);
      d.guessed[u] = pts; d.gain[u] = pts; gnAddScore(st, u, pts);
    });
    gnBroadcastSys(`${gnName(u)} guessed the movie!`, true);
    return;
  }
  if (gnLev(g, full) <= (full.length >= 8 ? 2 : 1) || gnLev(g, noThe) <= (noThe.length >= 8 ? 2 : 1)) gnSend({ t: 'close', to: u, text: t });
  gnSend({ t: 'chat', u, text: t });
}
function gnLev(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 9;
  const m = a.length, n = b.length, dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
function gdMaskHtml(d, me) {
  const w = d.word; if (!w) return '';
  const show = d.drawer === me || d.guessed[me] != null || d.phase === 'reveal';
  if (show) return `<span class="font-semibold tracking-wide ${d.drawer === me ? 'text-white' : 'text-green-400'}">${esc(w.title)}</span>`;
  const rev = new Set(d.reveal), words = String(w.title).split(' ');
  let pos = 0;
  const html = words.map(word => { const s = word.split('').map((c, k) => { const i = pos + k; return /[A-Za-z0-9À-ɏ]/.test(c) ? (rev.has(i) ? `<span class="inline-block w-[0.9em] text-center">${esc(c.toUpperCase())}</span>` : '<span class="inline-block w-[0.9em] text-center">_</span>') : `<span>${esc(c)}</span>`; }).join(''); pos += word.length + 1; return `<span class="whitespace-nowrap">${s}</span>`; }).join('<span class="inline-block w-3"></span>');
  const counts = words.map(x => gdLetters(x).length).filter(Boolean).join(', ');
  return `<span class="font-mono text-lg tracking-[0.12em] text-white sm:text-xl">${html}</span><span class="ml-2 text-xs text-white/45">(${counts})</span>`;
}

// ---- the canvas
function gnCanvasWrap() {
  if (GN.wrap) return GN.wrap;
  const w = document.createElement('div');
  w.id = 'gnCanvasWrap'; w.className = 'relative w-full select-none overflow-hidden rounded-xl bg-white'; w.style.aspectRatio = '4 / 3'; w.style.touchAction = 'none';
  const c = document.createElement('canvas'); c.className = 'absolute inset-0 h-full w-full'; c.style.touchAction = 'none';
  w.appendChild(c); GN.wrap = w; GN.canvas = c; GN.ctx = c.getContext('2d');
  if ('ResizeObserver' in window) new ResizeObserver(gnResize).observe(w);
  c.addEventListener('pointerdown', gnPDown); c.addEventListener('pointermove', gnPMove);
  window.addEventListener('pointerup', gnPUp); c.addEventListener('pointercancel', gnPUp);
  return w;
}
function gnResize() {
  const c = GN.canvas; if (!c || !GN.wrap) return; const r = GN.wrap.getBoundingClientRect(); if (!r.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; gnRedraw(); }
}
function gnRedraw() { const ctx = GN.ctx, c = GN.canvas; if (!ctx) return; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); GN.strokes.forEach(s => gnStrokeDraw(s, 0)); }
function gnStrokeDraw(s, from) {
  const c = GN.canvas, ctx = GN.ctx; if (!ctx || !s || !s.p.length) return;
  const W = c.width, H = c.height, p = s.p;
  ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, s.w * W);
  if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0] * W, p[0][1] * H, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); return; }
  const st = Math.max(0, from - 1);
  ctx.beginPath(); ctx.moveTo(p[st][0] * W, p[st][1] * H);
  for (let i = st + 1; i < p.length; i++) ctx.lineTo(p[i][0] * W, p[i][1] * H);
  ctx.stroke();
}
function gnCanDraw() { const st = GN.st, d = st && st.d; return !!(st && st.phase === 'play' && st.game === 'draw' && d && d.phase === 'draw' && d.drawer === gnMe().id); }
function gnPt(e) { const r = GN.canvas.getBoundingClientRect(); const f = v => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000; return [f((e.clientX - r.left) / r.width), f((e.clientY - r.top) / r.height)]; }
function gnPDown(e) {
  if (!gnCanDraw()) return; e.preventDefault();
  try { GN.canvas.setPointerCapture(e.pointerId); } catch (x) {}
  const s = { c: GN.tool.erase ? '#ffffff' : GN.tool.c, w: GN.tool.w / 800, p: [gnPt(e)] };
  GN.strokes.push(s); GN.cur = s; gnStrokeDraw(s, 0); GN.out.push({ k: 'b', c: s.c, w: s.w, p: s.p[0] });
}
function gnPMove(e) {
  if (!GN.cur) return; e.preventDefault();
  const pt = gnPt(e), l = GN.cur.p[GN.cur.p.length - 1]; if (Math.abs(pt[0] - l[0]) + Math.abs(pt[1] - l[1]) < 0.003) return;
  GN.cur.p.push(pt); gnStrokeDraw(GN.cur, GN.cur.p.length - 1);
  const last = GN.out[GN.out.length - 1]; if (last && last.k === 'm') last.p.push(pt); else GN.out.push({ k: 'm', p: [pt] });
}
function gnPUp() { GN.cur = null; }
function gnFlush() { if (!GN.out.length || !GN.ch) return; const ops = GN.out; GN.out = []; gnSend({ t: 'draw', u: gnMe().id, ops }); }
function gnApplyOps(ops) {
  ops.forEach(o => {
    if (o.k === 'b') { const s = { c: o.c, w: o.w, p: [o.p] }; GN.strokes.push(s); GN.rcur = s; gnStrokeDraw(s, 0); }
    else if (o.k === 'm' && GN.rcur) { const n = GN.rcur.p.length; GN.rcur.p.push(...o.p); gnStrokeDraw(GN.rcur, n); }
    else if (o.k === 'u') { GN.strokes.pop(); GN.rcur = null; gnRedraw(); }
    else if (o.k === 'x') { GN.strokes = []; GN.rcur = null; gnRedraw(); }
  });
}
function gnTool(k, v) {
  if (k === 'c') { GN.tool.c = v; GN.tool.erase = false; }
  if (k === 'w') GN.tool.w = v;
  if (k === 'erase') GN.tool.erase = !GN.tool.erase;
  if (k === 'undo' && gnCanDraw() && GN.strokes.length) { GN.strokes.pop(); gnRedraw(); GN.out.push({ k: 'u' }); }
  if (k === 'clear' && gnCanDraw()) { GN.strokes = []; gnRedraw(); GN.out.push({ k: 'x' }); }
  const tb = document.getElementById('gnTools'); if (tb) tb.outerHTML = gdToolsHtml();
}
function gdToolsHtml() {
  const t = GN.tool;
  const colors = GN_COLORS.map(c => `<button type="button" onclick="gnTool('c','${c}')" aria-label="Colour ${c}" class="h-6 w-6 shrink-0 rounded-full ring-2 sm:h-7 sm:w-7 ${!t.erase && t.c === c ? 'ring-white scale-110' : 'ring-white/15'} transition" style="background:${c}"></button>`).join('');
  const sizes = GN_SIZES.map(w => `<button type="button" onclick="gnTool('w',${w})" aria-label="Brush size ${w}" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.w === w ? 'bg-white/20' : 'bg-white/[0.06]'}"><span class="rounded-full bg-white" style="width:${Math.min(22, w)}px;height:${Math.min(22, w)}px"></span></button>`).join('');
  const btn = (k, icon, label, on) => `<button type="button" onclick="gnTool('${k}')" aria-label="${label}" title="${label}" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-white text-black' : 'bg-white/[0.06] text-white'}"><i class="fa-solid ${icon} text-sm"></i></button>`;
  return `<div id="gnTools" class="flex flex-col items-center gap-2 py-1 lg:flex-row lg:justify-center"><div class="flex flex-wrap justify-center gap-1 sm:gap-1.5">${colors}</div><span class="hidden h-6 w-px shrink-0 bg-white/15 lg:block"></span><div class="flex items-center gap-1.5">${sizes}<span class="mx-1 h-6 w-px shrink-0 bg-white/15"></span>${btn('erase', 'fa-eraser', 'Eraser', t.erase)}${btn('undo', 'fa-rotate-left', 'Undo')}${btn('clear', 'fa-trash', 'Clear the drawing')}</div></div>`;
}

// ================= MOVIE FIBBER =================
function gfFilmPool() {
  const v = m => m.totalVotes || 0;
  return mediaDatabase.filter(m => m.type === 'Movie' && m.poster && m.synopsis && m.synopsis.length > 60 && (m.language === 'en' || dcIsIndian(m)) && v(m) >= 300 && v(m) <= 25000 && gfReal(m));
}
function gfReal(m) {
  let s = String(m.synopsis || '').replace(/\s+/g, ' ').trim();
  const first = (s.match(/^.+?[.!?](?=\s|$)/) || [s])[0];
  if (first.length >= 40 && first.length <= 170) return first;
  if (first.length > 170) { const cut = first.slice(0, 165); const c = cut.lastIndexOf(', '); const out = (c > 60 ? cut.slice(0, c) : cut.replace(/\s+\S*$/, '')).replace(/[,;:\s]+$/, ''); return out + '.'; }
  return null;
}
function gfInit(st) { st.f = { round: 1, used: [] }; gfNew(st); }
function gfNew(st) {
  const f = st.f, pool = gfFilmPool().filter(m => !f.used.includes(m.id));
  const m = pool[gnRand(pool.length)]; if (!m) { gnEnd(st); return; }
  f.used.push(m.id); f.film = gnCompact(m); f.real = gfReal(m); f.fibs = {}; f.options = null; f.votes = {}; f.gain = {}; f.phase = 'write';
  gnDeadline(st, 75);
}
function gfFib(u, text) {
  const st = GN.st, f = st && st.f; if (!f || f.phase !== 'write') return;
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 150); if (t.length < 3) return;
  gnUpdate(st => { st.f.fibs[u] = gnNorm(t) === gnNorm(st.f.real) ? t + ' ' : t; if (gnPresent().every(x => st.f.fibs[x] != null)) gfToVote(st); });
}
function gfToVote(st) {
  const f = st.f;
  const opts = [{ id: 'real', text: f.real }].concat(Object.entries(f.fibs).map(([u, text]) => ({ id: u, text })));
  if (opts.length < 2) { gfReveal(st); return; }
  f.options = gnShuffle(opts); f.phase = 'vote'; gnDeadline(st, 40);
}
function gfVote(u, o) {
  const st = GN.st, f = st && st.f; if (!f || f.phase !== 'vote' || o === u || !f.options.some(x => x.id === o)) return;
  gnUpdate(st => { st.f.votes[u] = o; if (gnPresent().every(x => st.f.votes[x] != null)) gfReveal(st); });
}
function gfReveal(st) {
  const f = st.f; f.gain = {};
  Object.entries(f.votes).forEach(([u, o]) => {
    if (o === 'real') { f.gain[u] = (f.gain[u] || 0) + 200; gnAddScore(st, u, 200); }
    else if (o !== u) { f.gain[o] = (f.gain[o] || 0) + 100; gnAddScore(st, o, 100); }
  });
  f.phase = 'reveal'; gnDeadline(st, 14);
}
function gfTick(st) {
  const f = st.f; if (!f || Date.now() <= st.deadline) return;
  if (f.phase === 'write') gnUpdate(st => gfToVote(st));
  else if (f.phase === 'vote') gnUpdate(st => gfReveal(st));
  else if (f.phase === 'reveal') gnUpdate(st => { if (st.f.round >= st.settings.fibRounds) gnEnd(st); else { st.f.round++; gfNew(st); } });
}

// ================= WHO'S THE IMPOSTOR? =================
function giInit(st) { st.i = { round: 1, used: [] }; giNew(st); }
function giNew(st) {
  const i = st.i, v = m => m.totalVotes || 0;
  const pool = mediaDatabase.filter(m => m.type === 'Movie' && m.poster && !i.used.includes(m.id) && ((m.language === 'en' && v(m) >= 6000) || (dcIsIndian(m) && v(m) >= 400)));
  let A = null, B = null;
  for (let tries = 0; tries < 30 && !B; tries++) {
    A = pool[gnRand(pool.length)]; if (!A) break;
    let sims = []; try { sims = dcSimilar(A, 4, 6); } catch (e) {}
    B = sims.find(x => x.poster && gnNorm(x.title) !== gnNorm(A.title)) || null;
  }
  if (!A || !B) { gnEnd(st); return; }
  const here = gnPresent();
  i.used.push(A.id); i.A = gnCompact(A); i.B = gnCompact(B); i.imp = here[gnRand(here.length)];
  i.order = gnShuffle(here); i.turn = 0; i.lap = 1; i.clues = []; i.votes = {}; i.guessOpts = null; i.impGuess = null; i.caught = null; i.gain = {}; i.phase = 'clue';
  gnDeadline(st, 30);
}
function giClue(u, text) {
  const st = GN.st, i = st && st.i; if (!i || i.phase !== 'clue' || i.order[i.turn] !== u) return;
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 30); if (!t) return;
  gnUpdate(st => { st.i.clues.push({ u, text: t, lap: st.i.lap }); giAdvance(st); });
}
function giAdvance(st) {
  const i = st.i, here = new Set(gnPresent());
  do { i.turn++; if (i.turn >= i.order.length) { i.turn = 0; i.lap++; } } while (i.lap <= st.settings.impLaps && !here.has(i.order[i.turn]));
  if (i.lap > st.settings.impLaps) { i.phase = 'vote'; gnDeadline(st, 60); }
  else gnDeadline(st, 30);
}
function giVote(u, target) {
  const st = GN.st, i = st && st.i; if (!i || i.phase !== 'vote' || target === u) return;
  gnUpdate(st => { st.i.votes[u] = target; if (gnPresent().every(x => st.i.votes[x] != null)) giTally(st); });
}
function giTally(st) {
  const i = st.i, n = {}; Object.values(i.votes).forEach(t => { n[t] = (n[t] || 0) + 1; });
  const max = Math.max(0, ...Object.values(n)), top = Object.keys(n).filter(k => n[k] === max);
  i.caught = max > 0 && top.length === 1 && top[0] === i.imp;
  if (i.caught) {
    let others = []; try { others = dcSimilar(mediaDatabase.find(m => m.id === i.A.id), 6, 10); } catch (e) {}
    const opts = [i.A].concat(others.filter(x => x.id !== i.B.id && x.id !== i.A.id).slice(0, 3).map(gnCompact));
    i.guessOpts = gnShuffle(opts); i.phase = 'guess'; gnDeadline(st, 25);
  } else giReveal(st);
}
function giGuess(u, id) {
  const st = GN.st, i = st && st.i; if (!i || i.phase !== 'guess' || u !== i.imp) return;
  gnUpdate(st => { st.i.impGuess = id; giReveal(st); });
}
function giReveal(st) {
  const i = st.i; i.gain = {};
  if (i.caught) {
    Object.entries(i.votes).forEach(([u, t]) => { if (t === i.imp) { i.gain[u] = 100; gnAddScore(st, u, 100); } });
    if (i.impGuess === i.A.id) { i.gain[i.imp] = 150; gnAddScore(st, i.imp, 150); }
  } else { i.gain[i.imp] = 300; gnAddScore(st, i.imp, 300); }
  i.phase = 'reveal'; gnDeadline(st, 14);
}
function giTick(st) {
  const i = st.i; if (!i) return;
  const here = new Set(gnPresent());
  if (i.phase === 'clue' && !here.has(i.order[i.turn])) { gnUpdate(st => giAdvance(st)); return; }
  if (Date.now() <= st.deadline) return;
  if (i.phase === 'clue') gnUpdate(st => { st.i.clues.push({ u: st.i.order[st.i.turn], text: '(no clue)', lap: st.i.lap, miss: true }); giAdvance(st); });
  else if (i.phase === 'vote') gnUpdate(st => giTally(st));
  else if (i.phase === 'guess') gnUpdate(st => giReveal(st));
  else if (i.phase === 'reveal') gnUpdate(st => { if (st.i.round >= st.settings.impRounds) gnEnd(st); else { st.i.round++; giNew(st); } });
}

// ================= SCREEN =================
function gnRender(full) {
  const r = document.getElementById('gnRoot'); if (!r) return;
  if (!GN.code) { r.innerHTML = gnLandingHtml(); return; }
  if (full || !document.getElementById('gnStage')) { r.innerHTML = gnShellHtml(); gnFeedRender(); }
  gnRenderTop(); gnRenderPlayers(); gnRenderStage(); gnRenderChatInput();
}
function gnLandingHtml() {
  const me = gnMe(), code = GN.joinCode || '';
  const card = (g) => `<div class="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08]"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-200"><i class="fa-solid ${GN_GAMES[g].icon}"></i></span><div><div class="font-medium text-white">${GN_GAMES[g].name}</div><div class="mt-0.5 text-sm leading-snug text-white/55">${GN_GAMES[g].desc}</div></div></div>`;
  return `
    <div class="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4"><div class="font-display text-xl">Game night</div><button type="button" onclick="closeGames()" class="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/80 hover:bg-white/10" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-10">
        <div><h1 class="font-display text-3xl sm:text-4xl">Play movie games with friends</h1><p class="mt-2 text-white/55">Start a room, send the link, and play together live on phones or computers. No sign-in needed. Use a call or WhatsApp to talk while you play.</p></div>
        <div class="space-y-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
          <label class="block text-sm text-white/70">Your name<input id="gnNameInput" maxlength="16" value="${esc(me.name)}" placeholder="e.g. Rahul" autocomplete="nickname" class="mt-1.5 w-full rounded-xl bg-white/[0.06] px-4 py-3 text-base text-white ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-white/30"></label>
          <div class="grid gap-3 sm:grid-cols-2">
            <button type="button" onclick="gnCreate()" class="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition active:scale-[.98] sm:hover:bg-white/90"><i class="fa-solid fa-plus mr-2 text-xs"></i>Create a room</button>
            <div class="flex gap-2"><input id="gnCodeInput" maxlength="8" value="${esc(code)}" placeholder="Room code" autocapitalize="characters" class="min-w-0 flex-1 rounded-full bg-white/[0.06] px-4 py-3 text-sm uppercase tracking-widest text-white ring-1 ring-white/10 placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30 focus:outline-none focus:ring-white/30" onkeydown="if(event.key==='Enter')gnJoinTyped()"><button type="button" onclick="gnJoinTyped()" class="rounded-full px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/10">Join</button></div>
          </div>
        </div>
        <div class="space-y-3">${Object.keys(GN_GAMES).map(card).join('')}</div>
      </div>
    </div>`;
}
function gnShellHtml() {
  return `
    <div class="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3 sm:px-4">
      <div class="hidden whitespace-nowrap font-display text-xl sm:block">Game night</div>
      <span class="rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-xs tracking-widest text-white/80 ring-1 ring-white/10">${esc(GN.code)}</span>
      <button type="button" onclick="gnCopy()" class="flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs text-white/80 hover:bg-white/10" aria-label="Copy invite link"><i class="fa-solid fa-link text-[11px]"></i><span class="hidden sm:inline">Copy link</span></button>
      <button type="button" onclick="gnWhatsApp()" class="flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs text-white/80 hover:bg-white/10" aria-label="Invite on WhatsApp"><i class="fa-brands fa-whatsapp text-[13px]"></i><span class="hidden sm:inline">Invite</span></button>
      <div id="gnTop" class="ml-auto flex min-w-0 items-center gap-2 whitespace-nowrap text-sm"></div>
      <button type="button" onclick="closeGames()" class="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs text-white/80 hover:bg-rose-500/20" aria-label="Leave the room"><i class="fa-solid fa-right-from-bracket text-[11px]"></i><span class="hidden sm:inline">Leave</span></button>
    </div>
    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside id="gnPlayers" class="no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 px-3 py-2 lg:w-60 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-3"></aside>
      <main id="gnStage" class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5"></main>
      <section class="flex h-[30vh] shrink-0 flex-col border-t border-white/10 lg:h-auto lg:w-80 lg:border-l lg:border-t-0">
        <div id="gnFeed" class="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm"></div>
        <form onsubmit="gnSubmitChat(event)" class="flex gap-2 border-t border-white/10 p-2">
          <input id="gnChatInput" maxlength="80" autocomplete="off" enterkeyhint="send" class="min-w-0 flex-1 rounded-full bg-white/[0.06] px-4 py-2.5 text-[15px] text-white ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-white/30">
          <button type="submit" class="rounded-full bg-white px-4 text-sm font-semibold text-black" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
        </form>
      </section>
    </div>`;
}
function gnRenderTop() {
  const el = document.getElementById('gnTop'); if (!el) return;
  const st = GN.st; let txt = '';
  if (st && st.phase === 'play') {
    const r = st.game === 'draw' && st.d ? `Round ${Math.min(st.d.round, st.settings.rounds)}/${st.settings.rounds}` : st.game === 'fib' && st.f ? `Round ${st.f.round}/${st.settings.fibRounds}` : st.i ? `Round ${st.i.round}/${st.settings.impRounds}` : '';
    txt = `<span class="hidden text-white/55 sm:inline">${esc(GN_GAMES[st.game].name)} ·</span><span class="text-white/70">${r}</span><span id="gnTimer" class="w-9 text-right font-semibold tabular-nums"></span>`;
  } else txt = `<span class="text-white/55">${GN.members.length} player${GN.members.length === 1 ? '' : 's'}</span>`;
  el.innerHTML = txt; gnTick();
}
function gnRenderPlayers() {
  const el = document.getElementById('gnPlayers'); if (!el) return;
  const st = GN.st, me = gnMe().id, inGame = st && (st.phase === 'play' || st.phase === 'end');
  const score = u => inGame ? (st.scores[u] || 0) : ((st && st.total[u]) || 0);
  const list = GN.members.slice().sort((a, b) => score(b.id) - score(a.id));
  const d = st && st.phase === 'play' && st.game === 'draw' ? st.d : null;
  el.innerHTML = list.map((m, k) => {
    const isHost = GN.members[0] && GN.members[0].id === m.id;
    const badge = d && d.drawer === m.id ? '<i class="fa-solid fa-pencil text-[11px] text-amber-300" title="Drawing"></i>' : d && d.guessed && d.guessed[m.id] != null ? '<i class="fa-solid fa-check text-[11px] text-green-400" title="Guessed"></i>' : gnDone(m.id) ? '<i class="fa-solid fa-check text-[11px] text-green-400" title="Done"></i>' : '';
    const gain = gnGain(m.id);
    return `<div class="flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 ${m.id === me ? 'bg-white/[0.09]' : 'bg-white/[0.03]'} ring-1 ring-white/[0.06] lg:w-full">
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black" style="background:${esc(m.color)}">${esc(String(m.name).slice(0, 1).toUpperCase())}</span>
      <span class="min-w-0"><span class="flex items-center gap-1.5 text-[13px] font-medium leading-tight"><span class="max-w-[90px] truncate lg:max-w-[120px]">${esc(m.name)}</span>${m.id === me ? '<span class="text-white/40">(you)</span>' : ''}${isHost ? '<i class="fa-solid fa-crown text-[10px] text-amber-300" title="Host"></i>' : ''}${badge}</span><span class="block text-[11px] tabular-nums text-white/50">${score(m.id)} pts${gain ? ` <span class="text-green-400">+${gain}</span>` : ''}</span></span>
      ${inGame ? `<span class="ml-auto hidden text-xs text-white/35 lg:inline">#${k + 1}</span>` : ''}
    </div>`;
  }).join('');
}
function gnGain(u) {
  const st = GN.st; if (!st || st.phase !== 'play') return 0;
  if (st.game === 'draw' && st.d && st.d.phase !== 'choose') return st.d.gain[u] || 0;
  if (st.game === 'fib' && st.f && st.f.phase === 'reveal') return st.f.gain[u] || 0;
  if (st.game === 'imp' && st.i && st.i.phase === 'reveal') return st.i.gain[u] || 0;
  return 0;
}
function gnDone(u) {
  const st = GN.st; if (!st || st.phase !== 'play') return false;
  if (st.game === 'fib' && st.f) return (st.f.phase === 'write' && st.f.fibs[u] != null) || (st.f.phase === 'vote' && st.f.votes[u] != null);
  if (st.game === 'imp' && st.i) return st.i.phase === 'vote' && st.i.votes[u] != null;
  return false;
}
function gnTimeBar() { return '<div class="h-1 overflow-hidden rounded-full bg-white/10"><div id="gnTimeBar" class="h-full rounded-full bg-gradient-to-r from-purple-400 to-blue-400 transition-[width] duration-200 ease-linear" style="width:100%"></div></div>'; }
function gnPoster(f, cls) { return f && f.poster ? `<img src="${esc(typeof ps === 'function' ? ps(f.poster) : f.poster)}" alt="" class="${cls || 'h-24 w-16'} shrink-0 rounded-lg object-cover ring-1 ring-white/15">` : ''; }

function gnRenderStage() {
  const el = document.getElementById('gnStage'); if (!el) return;
  const st = GN.st;
  // while a drawing is on screen, refresh only the word line: re-building would interrupt the pen mid-stroke
  const key = st && st.phase === 'play' && st.game === 'draw' && st.d ? [st.d.round, st.d.turn, st.d.phase].join(':') : '';
  if (key && key === GN.stageKey && st.d.phase === 'draw' && document.getElementById('gnCanvasWrap')) {
    const w = document.getElementById('gnWordTop'); if (w) w.innerHTML = gdTopHtml(st);
    const h = document.getElementById('gnHint'); if (h) h.classList.toggle('hidden', !(st.d.drawer !== gnMe().id && st.d.guessed[gnMe().id] == null));
    return;
  }
  GN.stageKey = key;
  // keep what someone is typing, and where the cursor is, across re-renders
  const keep = {}; el.querySelectorAll('[data-keep]').forEach(x => { keep[x.id] = { v: x.value, f: document.activeElement === x, s: x.selectionStart }; });
  let html;
  if (!st) html = '<div class="py-20 text-center text-white/55">Connecting to the room…</div>';
  else if (st.phase === 'lobby') html = gnLobbyHtml(st);
  else if (st.phase === 'end') html = gnEndHtml(st);
  else if (st.game === 'draw') html = gdStageHtml(st);
  else if (st.game === 'fib') html = gfStageHtml(st);
  else html = giStageHtml(st);
  el.innerHTML = html;
  Object.entries(keep).forEach(([id, k]) => { const x = document.getElementById(id); if (x) { x.value = k.v; if (k.f) { x.focus(); try { x.setSelectionRange(k.s, k.s); } catch (e) {} } } });
  const slot = document.getElementById('gnCanvasSlot');
  if (slot) { slot.appendChild(gnCanvasWrap()); requestAnimationFrame(gnResize); }
  gnTick();
}
function gnLobbyHtml(st) {
  const host = gnIsHost(), g = st.game, s = st.settings;
  const cards = Object.keys(GN_GAMES).map(k => `<button type="button" ${host ? `onclick="gnSetGame('${k}')"` : 'disabled'} class="flex items-start gap-3 rounded-2xl p-4 text-left ring-1 transition ${g === k ? 'bg-purple-500/15 ring-purple-400/50' : 'bg-white/[0.03] ring-white/[0.08] ' + (host ? 'hover:bg-white/[0.06]' : '')}"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${g === k ? 'bg-purple-400 text-black' : 'bg-white/10 text-white/80'}"><i class="fa-solid ${GN_GAMES[k].icon}"></i></span><span><span class="block font-medium text-white">${GN_GAMES[k].name}</span><span class="mt-0.5 block text-[13px] leading-snug text-white/55">${GN_GAMES[k].desc}</span><span class="mt-1 block text-xs text-white/35">${GN_GAMES[k].min}+ players</span></span></button>`).join('');
  const sel = (k, opts) => host ? `<select onchange="gnSetting('${k}', this.value)" class="rounded-full bg-white/[0.06] px-3 py-2 text-sm text-white ring-1 ring-white/10">${opts.map(([v, l]) => `<option value="${v}" class="bg-[#14141A]" ${String(s[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>` : `<span class="rounded-full bg-white/[0.04] px-3 py-2 text-sm text-white/70">${(opts.find(([v]) => String(v) === String(s[k])) || [0, ''])[1]}</span>`;
  const settings = g === 'draw' ? `${sel('rounds', [[2, '2 rounds'], [3, '3 rounds'], [4, '4 rounds'], [5, '5 rounds']])}${sel('drawSec', [[60, '60 s to draw'], [80, '80 s to draw'], [100, '100 s to draw'], [120, '120 s to draw']])}${sel('pool', [['mix', 'Hollywood + Indian'], ['hw', 'Hollywood only'], ['in', 'Indian only']])}`
    : g === 'fib' ? sel('fibRounds', [[3, '3 rounds'], [4, '4 rounds'], [5, '5 rounds'], [6, '6 rounds']])
    : `${sel('impRounds', [[2, '2 rounds'], [3, '3 rounds'], [4, '4 rounds'], [5, '5 rounds']])}${sel('impLaps', [[1, '1 clue each'], [2, '2 clues each'], [3, '3 clues each']])}`;
  const n = GN.members.length, need = GN_GAMES[g].min;
  const start = host ? `<button type="button" onclick="gnStart()" class="w-full rounded-full bg-white py-3 text-sm font-semibold text-black transition active:scale-[.98] disabled:opacity-40 sm:w-auto sm:px-10 sm:hover:bg-white/90" ${n < need ? 'disabled' : ''}>Start ${esc(GN_GAMES[g].name)}</button>${n < need ? `<div class="mt-2 text-sm text-white/50">Waiting for ${need - n} more player${need - n === 1 ? '' : 's'}. Send the link to your friends.</div>` : ''}` : '<div class="rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white/60"><i class="fa-solid fa-hourglass-half mr-2 text-xs"></i>Waiting for the host to pick a game and start.</div>';
  return `
    <div class="mx-auto max-w-3xl space-y-5">
      <div class="rounded-2xl bg-gradient-to-br from-purple-500/15 to-blue-500/10 p-4 ring-1 ring-white/10 sm:p-5">
        <div class="text-xs uppercase tracking-[0.16em] text-white/50">Invite friends</div>
        <div class="mt-1 flex flex-wrap items-center gap-3"><span class="font-mono text-3xl tracking-[0.2em] text-white">${esc(GN.code)}</span><button type="button" onclick="gnCopy()" class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"><i class="fa-solid fa-link mr-1.5 text-xs"></i>Copy link</button><button type="button" onclick="gnWhatsApp()" class="rounded-full px-4 py-2 text-sm text-white ring-1 ring-white/20"><i class="fa-brands fa-whatsapp mr-1.5"></i>WhatsApp</button></div>
      </div>
      <div><h2 class="mb-2 font-display text-xl">${host ? 'Pick a game' : 'Game'}</h2><div class="grid gap-3">${cards}</div></div>
      <div class="flex flex-wrap items-center gap-2">${settings}</div>
      <div>${start}</div>
      <div class="flex items-center gap-2 border-t border-white/10 pt-4 text-sm"><span class="text-white/50">Your name</span><input id="gnRenameInput" data-keep maxlength="16" value="${esc(gnMe().name)}" class="w-36 rounded-full bg-white/[0.06] px-3 py-1.5 text-white ring-1 ring-white/10 focus:outline-none focus:ring-white/30"><button type="button" onclick="gnRename()" class="rounded-full px-3 py-1.5 text-white/80 ring-1 ring-white/15 hover:bg-white/10">Save</button></div>
    </div>`;
}
function gnEndHtml(st) {
  const ranked = Object.entries(st.scores || {}).sort((a, b) => b[1] - a[1]);
  const medal = ['🥇', '🥈', '🥉'];
  const rows = ranked.map(([u, v], k) => `<div class="flex items-center gap-3 rounded-xl px-4 py-3 ${k === 0 ? 'bg-amber-400/15 ring-1 ring-amber-300/30' : 'bg-white/[0.04]'}"><span class="w-7 text-center text-xl">${medal[k] || '#' + (k + 1)}</span><span class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-black" style="background:${esc(gnColor(u))}">${esc(gnName(u).slice(0, 1).toUpperCase())}</span><span class="min-w-0 flex-1 truncate font-medium">${esc(gnName(u))}</span><span class="font-semibold tabular-nums">${v}</span></div>`).join('');
  const host = gnIsHost();
  return `
    <div class="mx-auto max-w-xl space-y-5 text-center">
      <div><div class="text-xs uppercase tracking-[0.16em] text-purple-300/80">${esc(GN_GAMES[st.game].name)} · game over</div><h2 class="mt-1 font-display text-3xl">${ranked.length ? esc(gnName(ranked[0][0])) + ' wins!' : 'Game over'}</h2></div>
      <div class="space-y-2 text-left">${rows}</div>
      ${host ? `<div class="flex flex-col gap-2 sm:flex-row sm:justify-center"><button type="button" onclick="gnStart('${st.game}')" class="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black">Play again</button><button type="button" onclick="gnToLobby()" class="rounded-full px-8 py-3 text-sm text-white ring-1 ring-white/20">Choose another game</button></div>` : '<div class="text-sm text-white/55">Waiting for the host to start the next game.</div>'}
    </div>`;
}
function gdStageHtml(st) {
  const d = st.d, me = gnMe().id; if (!d) return '';
  const drawer = gnName(d.drawer), amDrawer = d.drawer === me;
  let top, body;
  if (d.phase === 'choose') {
    top = amDrawer ? '<span class="font-semibold text-white">Your turn! Pick a film to draw</span>' : `<span class="text-white/75"><b class="text-white">${esc(drawer)}</b> is choosing a film…</span>`;
    body = amDrawer ? `<div class="grid grid-cols-3 gap-2 sm:gap-4">${d.choices.map((c, i) => `<button type="button" onclick="gnDo('pick',{i:${i}})" class="group overflow-hidden rounded-xl bg-white/[0.05] text-left ring-1 ring-white/10 transition active:scale-[.98] sm:hover:ring-white/40">${gnPoster(c, 'aspect-[2/3] w-full')}<span class="block p-2 text-[13px] font-semibold leading-tight sm:text-sm">${esc(c.title)}</span><span class="block px-2 pb-2 text-[11px] text-white/45">${esc(c.year)}</span></button>`).join('')}</div>` : '<div class="flex aspect-[4/3] items-center justify-center rounded-xl bg-white/[0.04] text-white/50"><i class="fa-solid fa-paintbrush mr-2"></i>Get ready to guess</div>';
  } else {
    top = gdTopHtml(st);
    const reveal = d.phase === 'reveal' ? `<div class="absolute inset-0 z-10 flex items-center justify-center bg-black/75 p-4"><div class="flex items-center gap-4 text-left">${gnPoster(d.word, 'h-32 w-[86px] sm:h-40 sm:w-[106px]')}<div><div class="text-xs uppercase tracking-[0.16em] text-white/55">The film was</div><div class="font-display text-2xl sm:text-3xl">${esc(d.word ? d.word.title : '')}</div><div class="text-sm text-white/60">${esc(d.word ? d.word.year : '')}</div><div class="mt-2 text-sm ${Object.keys(d.guessed).length ? 'text-green-400' : 'text-rose-300'}">${Object.keys(d.guessed).length ? Object.keys(d.guessed).length + ' guessed it' : 'Nobody guessed it'}</div></div></div></div>` : '';
    body = `<div class="relative">${reveal}<div id="gnCanvasSlot"></div></div>${amDrawer && d.phase === 'draw' ? gdToolsHtml() : ''}`;
  }
  return `<div class="mx-auto max-w-[880px] space-y-2.5">
    <div id="gnWordTop" class="flex min-h-[36px] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">${top}</div>
    ${gnTimeBar()}
    ${body}
    <div id="gnHint" class="text-center text-xs text-white/40 ${!amDrawer && d.phase === 'draw' && d.guessed[me] == null ? '' : 'hidden'}">Type your guess in the chat. Faster guesses score more.</div>
  </div>`;
}
function gdTopHtml(st) { const d = st.d, me = gnMe().id; return d.drawer === me ? `<span class="text-xs uppercase tracking-wider text-white/50">Draw</span> ${gdMaskHtml(d, me)}` : gdMaskHtml(d, me); }
function gfStageHtml(st) {
  const f = st.f, me = gnMe().id; if (!f) return '';
  const film = `<div class="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08] sm:p-4">${gnPoster(f.film, 'h-24 w-16 sm:h-28 sm:w-[76px]')}<div class="min-w-0"><div class="text-xs uppercase tracking-[0.16em] text-white/50">The film</div><div class="font-display text-2xl leading-tight">${esc(f.film.title)}</div><div class="text-sm text-white/55">${esc(f.film.year)}${f.film.genres.length ? ' · ' + esc(f.film.genres.join(' · ')) : ''}</div></div></div>`;
  let body = '';
  if (f.phase === 'write') {
    const mine = f.fibs[me];
    body = mine != null ? `<div class="rounded-2xl bg-green-500/10 p-4 text-sm ring-1 ring-green-400/25"><div class="text-green-300">Your fake plot is in.</div><div class="mt-1 text-white/80">“${esc(mine)}”</div><div class="mt-2 text-white/50">Waiting for the others (${Object.keys(f.fibs).length}/${GN.members.length})…</div></div>`
      : `<div class="space-y-2"><div class="text-sm text-white/70">Write a <b class="text-white">fake plot</b> for this film, one sentence that sounds real. Others will try to spot the real one.</div><textarea id="gnFibText" data-keep maxlength="150" rows="3" placeholder="e.g. A retired chef must win one last cooking contest to save his village." class="w-full rounded-2xl bg-white/[0.06] p-4 text-[15px] text-white ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-white/30"></textarea><button type="button" onclick="gfSubmit()" class="w-full rounded-full bg-white py-3 text-sm font-semibold text-black sm:w-auto sm:px-8">Submit my fake plot</button></div>`;
  } else if (f.phase === 'vote') {
    const mineVote = f.votes[me];
    body = `<div class="text-sm text-white/70">Which one is the <b class="text-white">real plot</b>? ${mineVote ? '<span class="text-green-300">Vote in. You can still change it.</span>' : ''}</div><div class="grid gap-2">${f.options.filter(o => o.id !== me).map(o => `<button type="button" onclick="gnDo('vote',{o:'${esc(o.id)}'})" class="rounded-2xl px-4 py-3 text-left text-[15px] leading-snug ring-1 transition ${mineVote === o.id ? 'bg-purple-500/25 ring-purple-300/60' : 'bg-white/[0.05] ring-white/10 active:scale-[.99] sm:hover:bg-white/[0.09]'}">${esc(o.text)}</button>`).join('')}</div>`;
  } else {
    body = `<div class="grid gap-2">${f.options ? f.options.map(o => { const voters = Object.keys(f.votes).filter(u => f.votes[u] === o.id); const real = o.id === 'real'; return `<div class="rounded-2xl p-4 ring-1 ${real ? 'bg-green-500/15 ring-green-400/40' : 'bg-white/[0.04] ring-white/10'}"><div class="text-[15px] leading-snug">${esc(o.text)}</div><div class="mt-2 flex flex-wrap items-center gap-2 text-xs"><span class="${real ? 'font-semibold text-green-300' : 'text-white/55'}">${real ? 'THE REAL PLOT' : 'Fake by ' + esc(gnName(o.id))}</span>${voters.length ? '<span class="text-white/40">· picked by</span>' + voters.map(u => `<span class="rounded-full bg-white/10 px-2 py-0.5">${esc(gnName(u))}</span>`).join('') : '<span class="text-white/35">· nobody picked it</span>'}</div></div>`; }).join('') : `<div class="rounded-2xl bg-green-500/15 p-4 ring-1 ring-green-400/40">${esc(f.real)}</div>`}</div>`;
  }
  return `<div class="mx-auto max-w-2xl space-y-3">${gnTimeBar()}${film}${body}</div>`;
}
function gfSubmit() { const el = document.getElementById('gnFibText'); const t = el ? el.value.trim() : ''; if (t.length < 3) { showToast('Write a short fake plot first'); return; } gnDo('fib', { text: t }); }
function giStageHtml(st) {
  const i = st.i, me = gnMe().id; if (!i) return '';
  const myFilm = me === i.imp ? i.B : i.A;
  const card = (f, label, cls) => `<div class="flex items-center gap-3 rounded-2xl p-3 ring-1 ${cls || 'bg-white/[0.04] ring-white/[0.08]'}">${gnPoster(f, 'h-20 w-14')}<div class="min-w-0"><div class="text-xs uppercase tracking-[0.14em] text-white/50">${label}</div><div class="font-display text-xl leading-tight">${esc(f.title)}</div><div class="text-xs text-white/50">${esc(f.year)}</div></div></div>`;
  const clues = i.clues.length ? `<div class="space-y-1.5">${i.clues.map(c => `<div class="flex items-center gap-2 text-sm"><span class="h-2 w-2 shrink-0 rounded-full" style="background:${esc(gnColor(c.u))}"></span><span class="w-24 shrink-0 truncate text-white/60">${esc(gnName(c.u))}</span><span class="${c.miss ? 'text-white/35' : 'font-medium text-white'}">${esc(c.text)}</span></div>`).join('')}</div>` : '';
  let body = '';
  if (i.phase === 'clue') {
    const who = i.order[i.turn], mine = who === me;
    body = `<div class="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]"><div class="mb-2 text-sm text-white/70">Clue ${i.lap}/${st.settings.impLaps}: ${mine ? '<b class="text-white">your turn.</b> Give one word or a short hint about your film. Don\'t make it too obvious!' : `<b class="text-white">${esc(gnName(who))}</b> is thinking of a clue…`}</div>${mine ? `<div class="flex gap-2"><input id="gnClueInput" data-keep maxlength="30" placeholder="One word or a short hint" class="min-w-0 flex-1 rounded-full bg-white/[0.06] px-4 py-3 text-[15px] text-white ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-white/30" onkeydown="if(event.key==='Enter')giSubmitClue()"><button type="button" onclick="giSubmitClue()" class="rounded-full bg-white px-5 text-sm font-semibold text-black">Send</button></div>` : ''}${clues ? '<div class="mt-3 border-t border-white/10 pt-3">' + clues + '</div>' : ''}</div>`;
  } else if (i.phase === 'vote') {
    const mineVote = i.votes[me];
    body = `<div class="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">${clues}</div><div class="text-sm text-white/70">Who is the <b class="text-white">impostor</b>? Discuss in the chat, then vote. ${mineVote ? '<span class="text-green-300">Vote in.</span>' : ''}</div><div class="grid grid-cols-2 gap-2 sm:grid-cols-3">${GN.members.filter(m => m.id !== me).map(m => `<button type="button" onclick="gnDo('vote',{target:'${esc(m.id)}'})" class="flex items-center gap-2 rounded-2xl px-3 py-3 text-left ring-1 transition ${mineVote === m.id ? 'bg-rose-500/25 ring-rose-300/60' : 'bg-white/[0.05] ring-white/10 active:scale-[.98]'}"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black" style="background:${esc(m.color)}">${esc(m.name.slice(0, 1).toUpperCase())}</span><span class="truncate text-sm font-medium">${esc(m.name)}</span></button>`).join('')}</div>`;
  } else if (i.phase === 'guess') {
    body = me === i.imp ? `<div class="rounded-2xl bg-rose-500/15 p-4 ring-1 ring-rose-400/30"><div class="font-semibold text-rose-200">You were caught: you are the impostor!</div><div class="mt-1 text-sm text-white/70">Last chance: which film did everyone else have? Guess right for 150 points.</div></div><div class="grid grid-cols-2 gap-2 sm:grid-cols-4">${i.guessOpts.map(o => `<button type="button" onclick="gnDo('guess',{id:'${esc(o.id)}'})" class="overflow-hidden rounded-xl bg-white/[0.05] text-left ring-1 ring-white/10 active:scale-[.98]">${gnPoster(o, 'aspect-[2/3] w-full')}<span class="block p-2 text-[13px] font-semibold leading-tight">${esc(o.title)}</span></button>`).join('')}</div>`
      : `<div class="rounded-2xl bg-white/[0.04] p-5 text-center"><div class="font-display text-2xl">${esc(gnName(i.imp))} was the impostor!</div><div class="mt-1 text-sm text-white/60">They get one guess at your film for bonus points…</div></div>`;
  } else {
    const n = {}; Object.values(i.votes).forEach(t => { n[t] = (n[t] || 0) + 1; });
    body = `<div class="rounded-2xl p-4 text-center ring-1 ${i.caught ? 'bg-green-500/15 ring-green-400/30' : 'bg-rose-500/15 ring-rose-400/30'}"><div class="text-xs uppercase tracking-[0.16em] text-white/55">${i.caught ? 'Caught!' : 'The impostor got away!'}</div><div class="mt-1 font-display text-2xl">${esc(gnName(i.imp))} was the impostor</div>${i.caught ? `<div class="mt-1 text-sm ${i.impGuess === i.A.id ? 'text-green-300' : 'text-white/60'}">${i.impGuess === i.A.id ? 'and still guessed the film! +150' : i.impGuess ? 'and guessed the wrong film.' : 'and did not guess the film.'}</div>` : '<div class="mt-1 text-sm text-white/60">+300 for fooling everyone</div>'}</div>
      <div class="grid gap-2 sm:grid-cols-2">${card(i.A, 'Everyone else had')}${card(i.B, 'The impostor had', 'bg-rose-500/10 ring-rose-400/25')}</div>
      <div class="rounded-2xl bg-white/[0.03] p-4 text-sm ring-1 ring-white/[0.06]"><div class="mb-2 text-white/55">Votes</div>${Object.entries(n).sort((a, b) => b[1] - a[1]).map(([u, c]) => `<div>${esc(gnName(u))}: ${c}</div>`).join('') || '<div class="text-white/40">Nobody voted.</div>'}</div>`;
  }
  return `<div class="mx-auto max-w-2xl space-y-3">${gnTimeBar()}${i.phase === 'reveal' ? '' : card(myFilm, 'Your film', 'bg-gradient-to-br from-purple-500/15 to-blue-500/10 ring-white/10')}${i.phase === 'clue' || i.phase === 'vote' ? '<div class="text-center text-xs text-white/40">One of you has a different film, and nobody knows who. Maybe it is you!</div>' : ''}${body}</div>`;
}
function giSubmitClue() { const el = document.getElementById('gnClueInput'); const t = el ? el.value.trim() : ''; if (!t) return; el.value = ''; gnDo('clue', { text: t }); }

// ---------- chat
function gnRenderChatInput() {
  const el = document.getElementById('gnChatInput'); if (!el) return;
  const st = GN.st, d = st && st.phase === 'play' && st.game === 'draw' ? st.d : null, me = gnMe().id;
  const drawing = d && d.phase === 'draw' && d.drawer === me;
  el.disabled = !!drawing;
  el.placeholder = drawing ? 'You are drawing: no typing the answer!' : d && d.phase === 'draw' && d.guessed[me] == null ? 'Type your guess here…' : 'Chat with the room';
}
function gnSubmitChat(e) {
  e.preventDefault();
  const el = document.getElementById('gnChatInput'); const t = el.value.trim().slice(0, 80); if (!t || !GN.ch) return;
  const now = Date.now(); if (GN.lastChat && now - GN.lastChat < 400) return; GN.lastChat = now;
  el.value = '';
  const st = GN.st;
  if (st && st.phase === 'play' && st.game === 'draw') gnSend({ t: 'guess', u: gnMe().id, text: t });   // the host checks guesses and shows wrong ones
  else gnSend({ t: 'chat', u: gnMe().id, text: t });
}
function gnFeedAdd(m) { GN.feed.push(m); if (GN.feed.length > 150) GN.feed.shift(); const el = document.getElementById('gnFeed'); if (!el) return; el.insertAdjacentHTML('beforeend', gnFeedLine(m)); el.scrollTop = el.scrollHeight; }
function gnFeedRender() { const el = document.getElementById('gnFeed'); if (!el) return; el.innerHTML = GN.feed.map(gnFeedLine).join(''); el.scrollTop = el.scrollHeight; }
function gnFeedLine(m) {
  if (m.k === 'sys') return `<div class="text-[13px] italic text-white/45">${esc(m.text)}</div>`;
  if (m.k === 'ok') return `<div class="rounded-md bg-green-500/15 px-2 py-1 text-[13px] font-medium text-green-300">${esc(m.text)}</div>`;
  if (m.k === 'close') return `<div class="rounded-md bg-amber-400/15 px-2 py-1 text-[13px] text-amber-200">${esc(m.text)}</div>`;
  return `<div class="${m.k === 'gchat' ? 'text-green-200/80' : ''}"><b style="color:${esc(gnColor(m.u))}">${esc(gnName(m.u))}:</b> <span class="text-white/85">${esc(m.text)}</span></div>`;
}
function gnCopy() { try { navigator.clipboard.writeText(gnLink()); showToast('Invite link copied'); } catch (e) { prompt('Copy this link', gnLink()); } }
function gnWhatsApp() { window.open('https://wa.me/?text=' + encodeURIComponent(`Join my WatchVibe game night! Room ${GN.code}: ${gnLink()}`), '_blank', 'noopener'); }

// a ?game=CODE link opens the room
(function () {
  const code = new URLSearchParams(location.search).get('game'); if (!code) return;
  let tries = 0; const iv = setInterval(() => { if (window.supabaseClient && typeof mediaDatabase !== 'undefined' && mediaDatabase.length) { clearInterval(iv); openGames(code); } else if (++tries > 40) clearInterval(iv); }, 300);
})();
