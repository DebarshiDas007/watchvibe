// WatchVibe Game Night: Draw the Movie, Movie Fibber and Who's the Impostor?
// Rooms live in Supabase Realtime (broadcast + presence): nothing is stored, friends join with a link.
//
// Trust model (no server needed):
// - Every player makes a private signing key on their own device. Their player id is derived from the public key,
//   their presence entry is signed, and every message they send is signed. Nobody can speak for someone else.
// - One player is the host. The host runs the game, and only the host's signed state is accepted by the others.
//   The host is the first player in the room's join order who is in the room with their screen on; if the host
//   leaves or their screen is off for a few seconds, the next player takes over.
// - Secret things (the film to draw, the impostor and the films, who wrote which fake plot) stay on the host's
//   device. A player who must know a secret gets it encrypted just for them.
// Uses globals from index.html: mediaDatabase, esc, showToast, currentUserSession, dcIsIndian, dcSimilar, ps, Track, getActiveTmdbKey, TMDB_BASE_URL.

const GN = {
  code: null, ch: null, me: null, keys: null, st: null, sec: null, mine: {}, members: [], feed: [], strokes: [], strokesKey: '', out: [],
  tick: 0, flushT: 0, beatT: 0, tool: { c: '#111111', w: 7, erase: false }, cur: null, rcur: null, canvas: null, ctx: null, wrap: null,
  joinCode: '', pub: {}, aes: {}, valid: {}, vq: {}, lastN: {}, seq: 0, goneSince: {}, awaySince: {}, syncTok: 0, sendQ: Promise.resolve(),
  myFib: null, lastChat: 0, askT: [], stageKey: '', lost: {}
};
const GN_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GN_COLORS = ['#111111', '#ffffff', '#9ca3af', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#92400e'];
const GN_SIZES = [3, 7, 14, 26];
const GN_MAX = 10;
const GN_GRACE_GONE = 5000;     // a player who drops out for less than this (a reload, a network blip) keeps their turn
const GN_GRACE_AWAY = 6000;     // a host whose screen is off for longer than this hands the game to the next player
const GN_ID_RE = /^[a-z2-7]{10}$/;
const GN_GAMES = {
  draw: { name: 'Draw the Movie', min: 2, icon: 'fa-paintbrush', desc: 'One player draws a film. Everyone else races to type its name. Faster guesses score more.' },
  fib: { name: 'Movie Fibber', min: 3, icon: 'fa-masks-theater', desc: 'Everyone writes a fake plot for a real film. Spot the real plot and fool your friends with yours.' },
  imp: { name: "Who's the Impostor?", min: 3, icon: 'fa-user-secret', desc: 'Everyone gets the same film except one player, who gets a similar one. Give one-word clues, then vote out the impostor.' }
};

// ---------- small helpers
const gnNorm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
const gnRand = n => Math.floor(Math.random() * n);
function gnShuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = gnRand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const b64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(String(s || '')), c => c.charCodeAt(0));
const gnEnc = s => new TextEncoder().encode(s);
const gnCleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
function gnColorOf(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 70% 60%)`; }
function gnSavedName() {
  let n = ''; try { n = localStorage.getItem('gn_name') || ''; } catch (e) {}
  if (!n && typeof currentUserSession !== 'undefined' && currentUserSession && currentUserSession.name) n = String(currentUserSession.name).split(/\s+/)[0];
  return gnCleanName(n);
}
function gnLink() { return `${location.origin}/?game=${GN.code}`; }
function gnMember(u) { return GN.members.find(m => m.id === u) || null; }
function gnMeId() { return GN.me ? GN.me.id : ''; }
// two friends with the same name get a number, in join order
function gnName(u) {
  const m = gnMember(u); const base = m ? m.name : (GN.st && GN.st.names && GN.st.names[u] ? GN.st.names[u] : 'Player');
  const order = (GN.st && GN.st.joined) || GN.members.map(x => x.id);
  const same = order.filter(id => { const x = gnMember(id); const n = x ? x.name : (GN.st && GN.st.names && GN.st.names[id]); return n === base; });
  const k = same.indexOf(u); return k > 0 ? `${base} ${k + 1}` : base;
}
const gnColor = u => gnColorOf(u);
function gnDeadline(st, sec) { st.deadline = Date.now() + sec * 1000; st.dur = sec * 1000; }
function gnLeft(st) { return Math.max(0, Math.ceil(((st || GN.st || {}).deadline - Date.now()) / 1000)) || 0; }
function gnCompact(m) { return { id: m.id, title: m.title, year: m.year, poster: m.poster, genres: (m.genres || []).filter(g => !/^(Trending|Cinema|Series|Movie)$/i.test(g)).slice(0, 3) }; }

// ---------- presence: who is here, who can host
function gnHere(u) { if (gnMember(u)) return true; const g = GN.goneSince[u]; return !!(g && Date.now() - g < GN_GRACE_GONE); }
function gnHereIds() { const ids = new Set(GN.members.map(m => m.id)); Object.keys(GN.goneSince).forEach(u => { if (gnHere(u)) ids.add(u); }); return [...ids].filter(u => !GN.st || !GN.st.joined || GN.st.joined.includes(u)); }
function gnCanHost(u) { if (!gnHere(u)) return false; if (GN.lost[u] && Date.now() - GN.lost[u] < 30000 && !(u === gnMeId() && GN.st)) return false; const a = GN.awaySince[u]; return !(a && Date.now() - a > GN_GRACE_AWAY); }
function gnHostId() {
  const st = GN.st; if (!st) return null;
  if (st.host && gnCanHost(st.host)) return st.host;
  const next = (st.joined || []).find(u => gnCanHost(u)); if (next) return next;
  if (st.host && gnHere(st.host)) return st.host;               // everyone's screen is off: keep the host we have
  return (st.joined || []).find(u => gnHere(u)) || null;
}
function gnIsHost() { return !!(GN.st && GN.me && gnHostId() === GN.me.id); }

// ---------- keys and identity
async function gnIdOf(sk) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', gnEnc(sk.x + '.' + sk.y)));
  const a = 'abcdefghijklmnopqrstuvwxyz234567'; let s = ''; for (let i = 0; i < 10; i++) s += a[h[i] & 31]; return s;
}
async function gnInitKeys() {
  if (GN.me) return GN.me;
  if (!(window.crypto && crypto.subtle)) throw new Error('nocrypto');
  let saved = null; try { saved = JSON.parse(sessionStorage.getItem('gn_keys2') || 'null'); } catch (e) {}
  let sigPriv, sq, dhPriv, dq;
  if (saved && saved.sp && saved.dp) {
    sigPriv = await crypto.subtle.importKey('jwk', saved.sp, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    dhPriv = await crypto.subtle.importKey('jwk', saved.dp, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
    sq = saved.sq; dq = saved.dq;
  } else {
    const s = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const d = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const sp = await crypto.subtle.exportKey('jwk', s.privateKey), dp = await crypto.subtle.exportKey('jwk', d.privateKey);
    sq = await crypto.subtle.exportKey('jwk', s.publicKey); dq = await crypto.subtle.exportKey('jwk', d.publicKey);
    sigPriv = s.privateKey; dhPriv = d.privateKey;
    try { sessionStorage.setItem('gn_keys2', JSON.stringify({ sp, sq, dp, dq })); } catch (e) {}
  }
  const sk = { x: sq.x, y: sq.y }, dk = { x: dq.x, y: dq.y };
  GN.keys = { sigPriv, dhPriv };
  GN.me = { id: await gnIdOf(sk), name: gnSavedName(), sk, dk, ts: 0 };
  let n = 0; try { n = Number(sessionStorage.getItem('gn_seq') || 0); } catch (e) {}
  GN.seq = Math.max(n, Date.now());
  return GN.me;
}
const gnSigAlg = { name: 'ECDSA', hash: 'SHA-256' };
const gnPresBase = m => [m.id, m.name, m.dk.x, m.dk.y, m.ts].join('|');
async function gnValidMeta(key, m) {
  if (!m || m.id !== key || !GN_ID_RE.test(key) || !m.sk || !m.dk || typeof m.sk.x !== 'string' || typeof m.sk.y !== 'string' || typeof m.dk.x !== 'string' || typeof m.dk.y !== 'string' || typeof m.ps !== 'string') return false;
  const ck = key + '|' + m.ps; if (GN.valid[ck] !== undefined) return GN.valid[ck];
  let ok = false;
  try {
    if ((await gnIdOf(m.sk)) === key) {
      const k = GN.pub[key] || await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: m.sk.x, y: m.sk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      ok = await crypto.subtle.verify(gnSigAlg, k, unb64(m.ps), gnEnc(gnPresBase(m)));
      if (ok) GN.pub[key] = k;
    }
  } catch (e) { ok = false; }
  GN.valid[ck] = ok; return ok;
}
async function gnTrack() {
  const me = GN.me; if (!GN.ch || !me) return;
  const sig = await crypto.subtle.sign(gnSigAlg, GN.keys.sigPriv, gnEnc(gnPresBase(me)));
  GN.trackedAway = !!document.hidden; GN.trackedName = me.name; GN.trackedAt = Date.now();
  await GN.ch.track({ id: me.id, name: me.name, sk: me.sk, dk: me.dk, ts: me.ts, away: !!document.hidden, ps: b64(sig) });
}
async function gnAesWith(u) {
  if (GN.aes[u]) return GN.aes[u];
  const m = gnMember(u); if (!m || !m.dk) return null;
  const pk = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: m.dk.x, y: m.dk.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const k = await crypto.subtle.deriveKey({ name: 'ECDH', public: pk }, GN.keys.dhPriv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  GN.aes[u] = k; return k;
}

// ---------- sending and receiving (every message is signed; the sender also handles its own message right away)
function gnSend(obj) {
  if (!GN.ch || !GN.me) return;
  obj.n = ++GN.seq; try { sessionStorage.setItem('gn_seq', String(GN.seq)); } catch (e) {}
  const d = JSON.stringify(obj), ch = GN.ch, from = GN.me.id;
  GN.sendQ = GN.sendQ.then(async () => {
    const sig = await crypto.subtle.sign(gnSigAlg, GN.keys.sigPriv, gnEnc(d));
    ch.send({ type: 'broadcast', event: 'g', payload: { f: from, d, s: b64(sig) } });
  }).catch(() => {});
  gnHandle(obj, from);
}
function gnRecv(m) {
  const pl = m && m.payload; if (!pl || typeof pl.d !== 'string' || typeof pl.s !== 'string' || !GN_ID_RE.test(pl.f || '') || pl.d.length > 200000) return;
  const f = pl.f;
  GN.vq[f] = (GN.vq[f] || Promise.resolve()).then(async () => {
    const k = GN.pub[f]; if (!k) return;                       // not (yet) a known, verified player: ignore
    if (!(await crypto.subtle.verify(gnSigAlg, k, unb64(pl.s), gnEnc(pl.d)))) return;
    let obj; try { obj = JSON.parse(pl.d); } catch (e) { return; }
    if (!obj || typeof obj.n !== 'number' || obj.n <= (GN.lastN[f] || 0)) return;   // replayed or out of order
    GN.lastN[f] = obj.n;
    gnHandle(obj, f);
  }).catch(() => {});
}
async function gnSendSecret(u, data) {
  if (!GN.me) return;
  if (u === GN.me.id) { gnApplySecret(data); return; }
  try {
    const k = await gnAesWith(u); if (!k) return;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, gnEnc(JSON.stringify(data)));
    gnSend({ t: 'sec', to: u, iv: b64(iv), c: b64(c) });
  } catch (e) {}
}
async function gnOpenSecret(p, from) {
  try {
    const k = await gnAesWith(from); if (!k) return;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, k, unb64(p.c));
    gnApplySecret(JSON.parse(new TextDecoder().decode(plain)));
  } catch (e) {}
}
function gnApplySecret(data) { if (!data || typeof data.k !== 'string') return; GN.mine[data.k.split(':')[0]] = data; gnRenderStage(true); gnRenderPlayers(); }
function gnMine(kind, key) { const m = GN.mine[kind]; return m && m.k === key ? m : null; }

function gnHandle(p, from) {
  if (!p || typeof p.t !== 'string') return;
  const me = gnMeId(), host = gnHostId(), fromHost = from === host;
  switch (p.t) {
    case 'req':
      if (from === me) break;
      // the host itself asking for the game means its page reloaded and lost it: the next player takes over and sends it back
      if (GN.st && from === host) { GN.lost[from] = Date.now(); if (gnIsHost()) gnTakeOver(); }
      if (gnIsHost()) gnWelcome(from);
      break;
    case 'st': {
      if (from === me || !p.st || typeof p.st !== 'object') break;
      if (p.to && p.to !== me) break;
      const cur = GN.st;
      // accept the game only from its host: the one we expect, or a player taking over from a host who is gone
      const claims = p.st.host === from;
      const ok = cur ? (fromHost || (claims && !gnCanHost(cur.host) && (cur.joined || []).includes(from))) : claims;
      if (!ok) break;
      if (cur && !p.to && (p.st.v || 0) < (cur.v || 0)) break;
      if (cur && !p.to && (p.st.v || 0) === (cur.v || 0) && !p.hb) break;
      const st = p.st; if (!gnCleanState(st)) break;
      st.deadline = st.leftMs != null ? Date.now() + Math.min(600000, Math.max(0, Number(st.leftMs) || 0)) : null; delete st.leftMs;
      GN.st = st; gnAfterState(); break;
    }
    case 'strokes': if (fromHost && p.to === me && Array.isArray(p.s)) { GN.strokes = p.s; GN.strokesKey = p.key; gnRedraw(); } break;
    case 'draw': {
      const d = GN.st && GN.st.phase === 'play' && GN.st.game === 'draw' ? GN.st.d : null;
      if (from !== me && d && d.drawer === from && d.phase === 'draw' && Array.isArray(p.ops)) gnApplyOps(p.ops);
      break;
    }
    case 'chat': {
      const text = String(p.text || '').slice(0, 80); if (!text) break;
      if (p.g) { if (!fromHost) break; const d = GN.st && GN.st.d; const ok = d && (d.drawer === me || (d.guessed && d.guessed[me] != null)); if (!ok) break; gnFeedAdd({ k: 'gchat', u: p.u, text }); break; }
      if (p.relay) { if (!fromHost) break; gnFeedAdd({ k: 'chat', u: p.u, text }); break; }
      if (GN.st && GN.st.phase === 'play' && GN.st.game === 'draw') break;   // during drawing, chat goes through the host
      gnFeedAdd({ k: 'chat', u: from, text }); break;
    }
    case 'sys': if (fromHost) gnFeedAdd({ k: p.ok ? 'ok' : 'sys', text: String(p.text || '').slice(0, 140) }); break;
    case 'note': if (fromHost && p.to === me) gnFeedAdd({ k: 'close', text: String(p.text || '').slice(0, 140) }); break;
    case 'sec': if (fromHost && p.to === me) { if (from === me) break; gnOpenSecret(p, from); } break;
    case 'guess': if (gnIsHost()) gdGuess(from, p.text); break;
    case 'act': if (gnIsHost()) gnAct(from, p); break;
  }
}

// a state from another device is checked before use: known game and phase, ids that look like ids, numbers that are numbers
function gnCleanState(st) {
  if (!GN_GAMES[st.game] || !['lobby', 'play', 'end'].includes(st.phase) || !GN_ID_RE.test(st.host || '')) return false;
  st.v = Number(st.v) || 0;
  st.joined = (Array.isArray(st.joined) ? st.joined : []).filter(u => GN_ID_RE.test(u)).slice(0, GN_MAX);
  const num = (o, keys) => keys.forEach(k => { if (o && k in o) o[k] = Number(o[k]) || 0; });
  const numMap = o => { const out = {}; Object.entries(o || {}).forEach(([u, v]) => { if (GN_ID_RE.test(u)) out[u] = Number(v) || 0; }); return out; };
  st.settings = st.settings || {}; num(st.settings, ['rounds', 'drawSec', 'fibRounds', 'impRounds', 'impLaps']);
  if (!['mix', 'hw', 'in'].includes(st.settings.pool)) st.settings.pool = 'mix';
  st.scores = numMap(st.scores); st.total = numMap(st.total);
  const names = {}; Object.entries(st.names || {}).forEach(([u, n]) => { if (GN_ID_RE.test(u)) names[u] = gnCleanName(n); }); st.names = names;
  if (st.d) { num(st.d, ['round', 'turn']); st.d.gain = numMap(st.d.gain); st.d.guessed = numMap(st.d.guessed); st.d.order = (st.d.order || []).filter(u => GN_ID_RE.test(u)); }
  if (st.f) { num(st.f, ['round']); st.f.gain = numMap(st.f.gain); const v = {}; Object.entries(st.f.votes || {}).forEach(([u, k]) => { if (GN_ID_RE.test(u)) v[u] = Number(k) | 0; }); st.f.votes = v; }
  if (st.i) { num(st.i, ['round', 'turn', 'lap', 'tries']); st.i.gain = numMap(st.i.gain); st.i.order = (st.i.order || []).filter(u => GN_ID_RE.test(u)); }
  return true;
}

// ---------- host: state
function gnPack(st) { const o = JSON.parse(JSON.stringify(st)); o.leftMs = st.deadline ? Math.max(0, st.deadline - Date.now()) : null; delete o.deadline; return o; }
function gnUpdate(fn) { const st = GN.st; if (!st) return; fn(st); st.v = (st.v || 0) + 1; gnSend({ t: 'st', st: gnPack(st) }); gnAfterState(); }
function gnBeat() { if (gnIsHost() && GN.st) gnSend({ t: 'st', st: gnPack(GN.st), hb: 1 }); }
function gnLobbyState() { return { v: 1, phase: 'lobby', game: 'draw', host: gnMeId(), joined: [gnMeId()], names: {}, settings: { rounds: 3, drawSec: 80, pool: 'mix', fibRounds: 4, impRounds: 3, impLaps: 2 }, scores: {}, total: {} }; }
function gnWelcome(u) {
  gnSend({ t: 'st', st: gnPack(GN.st), to: u });
  if (GN.strokes.length) gnSend({ t: 'strokes', to: u, key: GN.strokesKey, s: GN.strokes });
  gnResendSecrets(u);
}
// what a player needs to know privately right now (sent again when they come back after a reload)
function gnResendSecrets(u) {
  const st = GN.st, s = GN.sec; if (!st || !s || st.phase !== 'play') return;
  if (st.game === 'draw' && st.d && s.draw && s.draw.k === gdKey(st)) {
    if (st.d.drawer === u) gnSendSecret(u, st.d.phase === 'choose' ? { k: s.draw.k, choices: s.draw.choices } : { k: s.draw.k, word: s.draw.word });
    else if (st.d.guessed && st.d.guessed[u] != null) gnSendSecret(u, { k: s.draw.k, word: s.draw.word });
  }
  if (st.game === 'imp' && st.i && s.imp && s.imp.k === giKey(st)) gnSendSecret(u, { k: s.imp.k, film: u === s.imp.imp ? s.imp.B : s.imp.A });
}

// ---------- room
function openGames(code) {
  let r = document.getElementById('gnRoot');
  if (!r) {
    r = document.createElement('div'); r.id = 'gnRoot'; r.className = 'fixed inset-0 z-[85] flex flex-col bg-[#0B0B0F] text-white';
    r.addEventListener('click', gnClick); document.body.appendChild(r);
  }
  document.documentElement.style.overflow = 'hidden';
  if (code) GN.joinCode = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  gnRender(true);
  if (GN.joinCode && !GN.code && gnSavedName()) gnJoin(GN.joinCode, false);
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
  const el = document.getElementById('gnNameInput'); const v = gnCleanName((el && el.value) || gnSavedName());
  if (!v) { showToast('Type your name first'); if (el) el.focus(); return false; }
  try { localStorage.setItem('gn_name', v); } catch (e) {}
  if (GN.me) GN.me.name = v;
  return true;
}
function gnRename() {
  const el = document.getElementById('gnRenameInput'); const v = gnCleanName(el && el.value); if (!v || !GN.me) return;
  GN.me.name = v; try { localStorage.setItem('gn_name', v); } catch (e) {}
  gnTrackSoon(); showToast('Name changed');
}
async function gnJoin(code, create) {
  const sb = window.supabaseClient;
  if (!sb || !sb.channel) { showToast('Live rooms are not available right now. Try again in a moment.'); return; }
  try { await gnInitKeys(); } catch (e) { showToast("This browser can't join game rooms. Try an up-to-date Chrome or Safari."); return; }
  if (GN.ch) gnLeave(true);
  const me = GN.me; me.name = gnSavedName(); me.ts = 0;
  Object.assign(GN, { code, members: [], feed: [], strokes: [], strokesKey: '', out: [], sec: null, mine: {}, myFib: null, lastN: {}, vq: {}, goneSince: {}, awaySince: {}, lost: {}, stageKey: '' });
  GN.st = create ? gnLobbyState() : null;
  history.replaceState(null, '', '?game=' + code);
  gnConnect(code, create);
  clearInterval(GN.tick); GN.tick = setInterval(gnTick, 250);
  clearInterval(GN.flushT); GN.flushT = setInterval(gnFlush, 150);
  clearInterval(GN.beatT); GN.beatT = setInterval(gnBeat, 5000);
  gnRender(true);
}
// the live connection: if it drops (a network blip, a sleeping phone), connect again and carry on from where we were
function gnConnect(code, create) {
  const sb = window.supabaseClient, me = GN.me;
  const ch = sb.channel('gn:' + code, { config: { broadcast: { self: false }, presence: { key: me.id } } });
  GN.ch = ch;
  ch.on('broadcast', { event: 'g' }, gnRecv)
    .on('system', {}, p => { if (p && p.status === 'error') { GN.lastErr = String(p.message || '').slice(0, 120); try { Track.event('game_conn', { m: GN.lastErr }); } catch (e) {} } })
    .on('presence', { event: 'sync' }, () => { if (GN.ch === ch) gnSyncMembers(); })
    .subscribe(async status => {
      if (GN.ch !== ch) return;
      if (status === 'SUBSCRIBED') {
        const again = !!me.ts;
        me.ts = me.ts || Date.now();
        await gnTrack();
        if (!create || again) gnAskState();
        if (!again) { gnSys(create ? 'Room created. Send the link to your friends.' : 'Joining the room…'); try { Track.event('game_room', { c: create ? 1 : 0 }); } catch (e) {} }
        else gnSys('Reconnected.');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (GN.code !== code) return;
        GN.closes = (GN.closes || []).concat([status + (GN.lastErr ? ': ' + GN.lastErr : '')]).slice(-5);
        GN.ch = null;
        try { sb.removeChannel(ch); } catch (e) {}
        gnSys('Connection lost. Reconnecting…');
        setTimeout(() => { if (GN.code === code && !GN.ch) gnConnect(code, false); }, 1500);
      }
    });
}
// ask the host for the game a few times (the host may not have seen us arrive yet); an empty room becomes ours
function gnAskState() {
  GN.askT.forEach(clearTimeout);
  GN.askT = [0, 1500, 4000, 8000].map(ms => setTimeout(() => { if (!GN.st && GN.ch) gnSend({ t: 'req' }); }, ms));
  GN.askT.push(setTimeout(() => {
    if (GN.st || !GN.ch) return;
    if (GN.members.every(m => m.id === gnMeId())) { GN.st = gnLobbyState(); gnSys('Nobody else is here yet, so you are the host.'); gnRender(true); }
  }, 6000));
}
function gnLeave(silent) {
  [GN.tick, GN.flushT, GN.beatT].forEach(clearInterval); GN.tick = GN.flushT = GN.beatT = 0; GN.askT.forEach(clearTimeout); GN.askT = [];
  const ch = GN.ch;
  Object.assign(GN, { ch: null, code: null, st: null, sec: null, mine: {}, members: [], feed: [], strokes: [] });
  if (ch && window.supabaseClient) { try { window.supabaseClient.removeChannel(ch); } catch (e) {} }
  if (!silent) gnRender(true);
}
async function gnSyncMembers() {
  if (!GN.ch) return;
  const tok = ++GN.syncTok, state = GN.ch.presenceState(), out = [];
  for (const [key, metas] of Object.entries(state)) {
    for (const m of metas || []) { if (await gnValidMeta(key, m)) { out.push({ id: key, name: gnCleanName(m.name) || 'Player', ts: Number(m.ts) || 0, away: !!m.away, dk: m.dk, color: gnColorOf(key) }); break; } }
  }
  if (tok !== GN.syncTok) return;
  const now = Date.now(), before = new Set(GN.members.map(m => m.id)), after = new Set(out.map(m => m.id));
  before.forEach(u => { if (!after.has(u)) GN.goneSince[u] = now; });
  out.forEach(m => { delete GN.goneSince[m.id]; if (m.away) GN.awaySince[m.id] = GN.awaySince[m.id] || now; else delete GN.awaySince[m.id]; });
  GN.members = out.sort((x, y) => (x.ts - y.ts) || x.id.localeCompare(y.id));
  gnMembersChanged();
}
function gnMembersChanged() {
  const st = GN.st;
  if (st && gnIsHost()) {
    const joined = st.joined || [], names = st.names || {}; let changed = false;
    GN.members.forEach(m => {
      if (!joined.includes(m.id) && joined.length < GN_MAX) { joined.push(m.id); changed = true; }
      if (joined.includes(m.id) && names[m.id] !== m.name) { names[m.id] = m.name; changed = true; }
    });
    if (changed) gnUpdate(s => { s.joined = joined; s.names = names; });
  }
  if (st && st.joined && GN.members.length >= GN_MAX && !st.joined.includes(gnMeId()) && GN.members.some(m => m.id === gnMeId())) { showToast(`This room is full (${GN_MAX} players).`); closeGames(); return; }
  gnRenderPlayers(); gnRenderTop();
  if (st && st.phase === 'lobby') gnRenderStage();
}
// tell the room when this screen goes off or on, but only when it really changed and never more than once every 3 s
// (Supabase closes a connection that updates its presence too often)
function gnTrackSoon() {
  clearTimeout(GN.trackT);
  GN.trackT = setTimeout(() => {
    if (!GN.ch || !GN.me || !GN.me.ts) return;
    const away = !!document.hidden; if (away === GN.trackedAway && GN.trackedName === GN.me.name) return;
    const wait = 3000 - (Date.now() - (GN.trackedAt || 0)); if (wait > 0) { gnTrackSoon(); return; }
    gnTrack();
  }, 1200);
}
document.addEventListener('visibilitychange', gnTrackSoon);

function gnAfterState() {
  const st = GN.st; if (!st) return;
  const mark = st.phase + ':' + st.game + ':' + (st.d ? gdKey(st) + st.d.phase : '') + (st.f ? st.f.round + st.f.phase : '') + (st.i ? st.i.round + st.i.phase : '');
  if (GN.lastMark && mark !== GN.lastMark) { if (st.phase === 'end') gnSound('end'); else if (st.phase === 'play' && ((st.d && st.d.phase === 'choose') || (st.f && st.f.phase === 'write') || (st.i && st.i.phase === 'clue' && !st.i.clues.length))) gnSound('turn'); }
  GN.lastMark = mark;
  const key = st.phase === 'play' && st.game === 'draw' && st.d ? gdKey(st) : '';
  if (key !== GN.strokesKey) { GN.strokes = []; GN.rcur = null; GN.cur = null; GN.strokesKey = key; gnRedraw(); }
  gnRenderPlayers(); gnRenderTop(); gnRenderStage(); gnRenderChatInput();
}
function gnSys(text, ok) { gnFeedAdd({ k: ok ? 'ok' : 'sys', text }); }
function gnBroadcastSys(text, ok) { gnSend({ t: 'sys', text, ok: !!ok }); }

// ---------- host: player actions (the sender is the verified signer, never a name in the message)
function gnAct(u, p) {
  const st = GN.st; if (!st || st.phase !== 'play' || !st.joined.includes(u)) return;
  if (st.game === 'draw' && p.a === 'pick') gdPick(u, p.i);
  if (st.game === 'fib') { if (p.a === 'fib') gfFib(u, p.text); if (p.a === 'vote') gfVote(u, p.k); }
  if (st.game === 'imp') { if (p.a === 'clue') giClue(u, p.text); if (p.a === 'vote') giVote(u, p.target); if (p.a === 'guess') giGuess(u, p.id); }
}
function gnDo(a, extra) { gnSend(Object.assign({ t: 'act', a }, extra || {})); }
// buttons carry their value in data attributes: nothing a player typed or chose ever becomes code
function gnClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const a = b.dataset.act, v = b.dataset.v || '';
  if (a === 'pick') gnDo('pick', { i: Number(v) | 0 });
  else if (a === 'fvote') gnDo('vote', { k: Number(v) | 0 });
  else if (a === 'ivote') { if (GN_ID_RE.test(v)) gnDo('vote', { target: v }); }
  else if (a === 'iguess') gnDo('guess', { id: v.slice(0, 120) });
  else if (a === 'game') { if (GN_GAMES[v]) gnSetGame(v); }
}

function gnSetGame(g) { if (gnIsHost() && GN.st && GN.st.phase !== 'play') gnUpdate(st => { st.game = g; st.phase = 'lobby'; }); }
function gnSetting(k, v) { if (gnIsHost() && GN.st && k in GN.st.settings) gnUpdate(st => { st.settings[k] = isNaN(Number(v)) ? String(v).slice(0, 8) : Number(v); }); }
function gnStart(g) {
  if (!gnIsHost() || !GN.st) return;
  const game = g || GN.st.game, need = GN_GAMES[game].min, n = gnHereIds().length;
  if (n < need) { showToast(`${GN_GAMES[game].name} needs at least ${need} players. Invite ${need - n} more.`); return; }
  GN.sec = {};
  gnUpdate(st => {
    st.game = game; st.phase = 'play'; st.scores = {}; gnHereIds().forEach(u => { st.scores[u] = 0; });
    delete st.d; delete st.f; delete st.i;
    if (game === 'draw') gdInit(st); else if (game === 'fib') gfInit(st); else giInit(st);
  });
  gnBroadcastSys(`${GN_GAMES[game].name} has started. Good luck!`);
  try { Track.event('game_start', { g: game, n }); } catch (e) {}
}
function gnEnd(st) {
  st.phase = 'end'; st.deadline = null; GN.sec = {};
  Object.entries(st.scores || {}).forEach(([u, v]) => { st.total[u] = (st.total[u] || 0) + v; });
}
function gnToLobby() { if (gnIsHost()) gnUpdate(st => { st.phase = 'lobby'; delete st.d; delete st.f; delete st.i; }); }
function gnAddScore(st, u, pts) { st.scores[u] = (st.scores[u] || 0) + pts; }

// a new host has no secrets from the old one: the turn or round in progress starts over
function gnTakeOver() {
  const prev = GN.st.host;
  gnUpdate(st => {
    st.host = gnMeId();
    if (st.phase !== 'play') return;
    if (st.game === 'draw' && st.d && (st.d.phase === 'choose' || st.d.phase === 'draw')) { st.d.turn++; gdBeginTurn(st); }
    if (st.game === 'fib' && st.f && st.f.phase !== 'reveal') gfNew(st);
    if (st.game === 'imp' && st.i && st.i.phase !== 'reveal') giNew(st);
  });
  gnBroadcastSys(`${gnName(gnMeId())} is hosting the game now.`);
}

// ---------- the clock (only the host moves the game on)
function gnTick() {
  const t = document.getElementById('gnTimer'); const st = GN.st;
  if (t) { const l = st && st.deadline ? gnLeft(st) : null; t.textContent = l == null ? '' : l + 's'; t.classList.toggle('text-rose-300', l != null && l <= 10); }
  const bar = document.getElementById('gnTimeBar');
  if (bar && st && st.deadline && st.dur) bar.style.width = Math.max(0, Math.min(100, (st.deadline - Date.now()) / st.dur * 100)) + '%';
  const ring = document.getElementById('gnClockRing'), ct = document.getElementById('gnClockText');
  if (ring && st && st.deadline && st.dur) {
    const f = Math.max(0, Math.min(1, (st.deadline - Date.now()) / st.dur)), l = gnLeft(st);
    ring.setAttribute('stroke-dashoffset', String(97.4 * (1 - f))); ring.setAttribute('stroke', l <= 10 ? '#f87171' : '#a78bfa');
    if (ct) { ct.textContent = l; ct.classList.toggle('text-rose-300', l <= 10); }
    const drawing = st.phase === 'play' && st.game === 'draw' && st.d && st.d.phase === 'draw';
    if (drawing && l <= 10 && l > 0 && l !== GN.lastTick) { GN.lastTick = l; gnSound('tick'); }
  }
  if (!st || !gnIsHost()) return;
  if (st.host !== gnMeId()) { gnTakeOver(); return; }
  if (st.phase !== 'play') return;
  if (gnHereIds().length < GN_GAMES[st.game].min) { gnUpdate(s => gnEnd(s)); gnBroadcastSys('Not enough players left, so the game has ended.'); return; }
  if (st.game === 'draw') gdTick(st); else if (st.game === 'fib') gfTick(st); else giTick(st);
}

// ================= DRAW THE MOVIE =================
const gdKey = st => 'd:' + st.d.round + ':' + st.d.turn;
const GN_NUM = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', ii: '2', iii: '3', iv: '4' };
function gdGuessNorm(s) {
  const words = String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter(Boolean).map(w => GN_NUM[w] || w);
  if (words[0] === 'the' || words[0] === 'a') words.shift();
  return words.join('');
}
function gnPools() {
  const v = m => m.totalVotes || 0, ok = m => m.type === 'Movie' && m.title && m.poster && m.title.length <= 24 && !/[:;]/.test(m.title);
  return { hw: mediaDatabase.filter(m => ok(m) && m.language === 'en' && !dcIsIndian(m) && v(m) >= 4000), ind: mediaDatabase.filter(m => ok(m) && dcIsIndian(m) && v(m) >= 300) };
}
function gdChoices(st) {
  const P = gnPools(), used = new Set(st.d.used), pick = (arr, n) => gnShuffle(arr.filter(m => !used.has(m.id))).slice(0, n);
  const mode = st.settings.pool;
  const out = mode === 'hw' ? pick(P.hw, 3) : mode === 'in' ? pick(P.ind, 3) : gnShuffle(pick(P.hw, 2).concat(pick(P.ind, 1)));
  return out.map(gnCompact);
}
function gdInit(st) { st.d = { round: 1, turn: 0, order: gnHereIds(), used: [], phase: 'choose', drawer: null, mask: '', counts: '', reveal: [], guessed: {}, gain: {}, word: null }; gdBeginTurn(st); }
function gdBeginTurn(st) {
  const d = st.d;
  gnHereIds().forEach(u => { if (!d.order.includes(u)) { d.order.push(u); st.scores[u] = st.scores[u] || 0; } });
  for (let guard = 0; ; guard++) {
    if (d.turn >= d.order.length) { d.round++; d.turn = 0; }
    if (d.round > st.settings.rounds || guard > 50) { gnEnd(st); return; }
    if (gnHere(d.order[d.turn])) break;
    d.turn++;
  }
  d.drawer = d.order[d.turn]; d.phase = 'choose'; d.word = null; d.mask = ''; d.counts = ''; d.reveal = []; d.guessed = {}; d.gain = {};
  const choices = gdChoices(st);
  GN.sec = GN.sec || {}; GN.sec.draw = { k: gdKey(st), choices, word: null, names: [] };
  gnDeadline(st, 15);
  setTimeout(() => gnSendSecret(d.drawer, { k: GN.sec.draw.k, choices }), 0);
}
function gdPick(u, i) { const st = GN.st, d = st && st.d; if (!d || d.phase !== 'choose' || u !== d.drawer) return; gnUpdate(st => gdStartDraw(st, i)); }
function gdStartDraw(st, i) {
  const d = st.d, s = GN.sec && GN.sec.draw; if (!s || s.k !== gdKey(st)) { d.turn++; gdBeginTurn(st); return; }
  const w = s.choices[Math.max(0, Math.min(s.choices.length - 1, i | 0))]; if (!w) { d.turn++; gdBeginTurn(st); return; }
  s.word = w; s.names = [gdGuessNorm(w.title)]; d.used.push(w.id);
  { const full = mediaDatabase.find(x => x.id === w.id); (full && full.alt || []).forEach(t => { const g = gdGuessNorm(t); if (g.length >= 3 && !s.names.includes(g)) s.names.push(g); }); } d.phase = 'draw'; d.reveal = []; d.guessed = {}; d.gain = {};
  gdMask(st); gnDeadline(st, st.settings.drawSec);
  setTimeout(() => gnSendSecret(d.drawer, { k: s.k, word: w }), 0);
  gdAltTitles(s);
}
// other names the film is known by (Indian films often have an English title on TMDB and a Hindi one people actually say)
async function gdAltTitles(s) {
  try {
    const m = mediaDatabase.find(x => x.id === s.word.id); const n = m && (m.tmdbId || (/(\d+)$/.exec(String(m.id)) || [])[1]); if (!n) return;
    const r = await fetch(`${TMDB_BASE_URL}/movie/${n}?api_key=${getActiveTmdbKey()}&append_to_response=alternative_titles`); if (!r.ok) return;
    const j = await r.json(), names = [j.original_title, j.title].concat(((j.alternative_titles && j.alternative_titles.titles) || []).filter(t => ['IN', 'US', 'GB'].includes(t.iso_3166_1)).map(t => t.title));
    names.filter(t => t && /[a-z]/i.test(t) && t.length <= 40).forEach(t => { const g = gdGuessNorm(t); if (g.length >= 3 && !s.names.includes(g)) s.names.push(g); });
  } catch (e) {}
}
function gdLetterIdx(title) { const idx = []; String(title).split('').forEach((c, i) => { if (/[A-Za-z0-9À-ɏ]/.test(c)) idx.push(i); }); return idx; }
function gdMask(st) {
  const d = st.d, w = GN.sec.draw.word; if (!w) return;
  const rev = new Set(d.reveal);
  d.mask = String(w.title).split('').map((c, i) => /[A-Za-z0-9À-ɏ]/.test(c) ? (rev.has(i) ? c.toUpperCase() : '_') : c).join('');
  d.counts = String(w.title).split(' ').map(x => gdLetterIdx(x).length).filter(Boolean).join(', ');
}
function gdTick(st) {
  const d = st.d; if (!d) return;
  const now = Date.now(), s = GN.sec && GN.sec.draw;
  if (d.phase === 'choose') {
    if (!gnHere(d.drawer)) { gnUpdate(st => { st.d.turn++; gdBeginTurn(st); }); return; }
    if (now > st.deadline) gnUpdate(st => gdStartDraw(st, gnRand(3)));
    return;
  }
  if (d.phase === 'draw') {
    if (!s || !s.word) { gnUpdate(st => { st.d.turn++; gdBeginTurn(st); }); return; }
    const guessers = gnHereIds().filter(u => u !== d.drawer);
    const allIn = guessers.length > 0 && guessers.every(u => d.guessed[u] != null);
    if (now > st.deadline || allIn || !gnHere(d.drawer)) { gnUpdate(st => gdReveal(st)); return; }
    const frac = 1 - (st.deadline - now) / st.dur, L = gdLetterIdx(s.word.title), want = frac >= 0.75 ? Math.ceil(L.length * 0.35) : frac >= 0.5 ? Math.ceil(L.length * 0.18) : 0;
    const target = Math.min(want, Math.max(0, L.length - 2));
    if (d.reveal.length < target) gnUpdate(st => { const free = L.filter(i => !st.d.reveal.includes(i)); while (st.d.reveal.length < target && free.length) st.d.reveal.push(free.splice(gnRand(free.length), 1)[0]); gdMask(st); });
    return;
  }
  if (d.phase === 'reveal' && now > st.deadline) gnUpdate(st => { st.d.turn++; gdBeginTurn(st); });
}
function gdReveal(st) {
  const d = st.d, n = Object.keys(d.guessed).length, s = GN.sec && GN.sec.draw;
  if (n) { const pts = Math.min(400, 60 * n); d.gain[d.drawer] = pts; gnAddScore(st, d.drawer, pts); }
  d.word = s && s.word ? s.word : null;      // the answer becomes public only now
  d.phase = 'reveal'; gnDeadline(st, 6);
}
function gdGuess(u, text) {
  const st = GN.st; if (!st || !(st.joined || []).includes(u)) return;
  const d = st.phase === 'play' && st.game === 'draw' ? st.d : null, s = GN.sec && GN.sec.draw;
  const t = String(text || '').trim().slice(0, 80); if (!t) return;
  if (!d || d.phase !== 'draw' || !s || !s.word) { gnSend({ t: 'chat', u, text: t, relay: 1 }); return; }
  if (u === d.drawer || d.guessed[u] != null) { gnSend({ t: 'chat', u, text: t, g: 1 }); return; }
  const g = gdGuessNorm(t);
  if (g && s.names.includes(g)) {
    gnUpdate(st => {
      const d = st.d, left = Math.max(0, st.deadline - Date.now()) / st.dur, first = Object.keys(d.guessed).length === 0;
      const pts = Math.round(100 + 300 * left) + (first ? 50 : 0);
      d.guessed[u] = pts; d.gain[u] = pts; gnAddScore(st, u, pts);
    });
    gnSendSecret(u, { k: s.k, word: s.word });
    gnBroadcastSys(`${gnName(u)} guessed the movie!`, true);
    return;
  }
  if (s.names.some(nm => gnLev(g, nm) <= (nm.length >= 8 ? 2 : 1))) gnSend({ t: 'note', to: u, text: `"${t}" is very close!` });
  gnSend({ t: 'chat', u, text: t, relay: 1 });
}
function gnLev(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 9;
  const m = a.length, n = b.length, dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
function gdMaskHtml(st) {
  const d = st.d, me = gnMeId(), mine = gnMine('d', gdKey(st));
  const word = d.word || (mine && mine.word);
  if (word && (d.drawer === me || d.guessed[me] != null || d.phase === 'reveal')) return `<span class="font-semibold tracking-wide ${d.drawer === me ? 'text-white' : 'text-green-400'}">${esc(word.title)}</span>`;
  if (!d.mask) return '';
  const html = String(d.mask).split(' ').map(w => `<span class="whitespace-nowrap">${w.split('').map(c => `<span class="inline-block ${/[_A-Z0-9À-ɏ]/i.test(c) ? 'w-[0.9em] text-center' : ''}">${esc(c)}</span>`).join('')}</span>`).join('<span class="inline-block w-3"></span>');
  return `<span class="font-mono text-lg tracking-[0.12em] text-white sm:text-xl">${html}</span><span class="ml-2 text-xs text-white/45">(${esc(d.counts)})</span>`;
}

// ---- the canvas
const GN_MIN_W = 2, GN_MAX_W = 40;
function gnCanvasWrap() {
  if (GN.wrap) return GN.wrap;
  const w = document.createElement('div');
  w.id = 'gnCanvasWrap'; w.className = 'relative w-full select-none overflow-hidden rounded-xl bg-white'; w.style.aspectRatio = '4 / 3'; w.style.touchAction = 'none';
  const c = document.createElement('canvas'); c.className = 'absolute inset-0 h-full w-full'; c.style.touchAction = 'none';
  const cur = document.createElement('div'); cur.className = 'pointer-events-none absolute left-0 top-0 hidden rounded-full'; cur.style.transform = 'translate(-50%,-50%)';
  w.appendChild(c); w.appendChild(cur); GN.wrap = w; GN.canvas = c; GN.ctx = c.getContext('2d'); GN.brushEl = cur;
  if ('ResizeObserver' in window) new ResizeObserver(gnResize).observe(w);
  c.addEventListener('pointerdown', gnPDown); c.addEventListener('pointermove', gnPMove);
  c.addEventListener('pointerup', gnPUp); c.addEventListener('pointercancel', gnPUp); c.addEventListener('lostpointercapture', gnPUp);
  c.addEventListener('pointerleave', () => { if (!GN.cur) cur.classList.add('hidden'); });
  return w;
}
function gnResize() {
  const c = GN.canvas; if (!c || !GN.wrap) return; const r = GN.wrap.getBoundingClientRect(); if (!r.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; gnRedraw(); }
}
// the board takes the space it has: as wide as possible while the word, the clock and the tools stay on screen
function gnFitBoard() {
  const stage = document.getElementById('gnStage'), wrap = GN.wrap, box = document.getElementById('gnDrawBox'), holder = document.getElementById('gnBoardBox');
  if (!stage || !wrap || !box || !holder || !box.contains(wrap)) return;
  const cs = getComputedStyle(stage);
  const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const others = box.getBoundingClientRect().height - holder.getBoundingClientRect().height;
  const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - others - 2;
  const w = Math.floor(Math.max(220, Math.min(availW, 880, availH * 4 / 3)));
  if (Math.abs((parseFloat(holder.style.width) || 0) - w) > 1) { holder.style.width = w + 'px'; }
}
function gnRedraw() { const ctx = GN.ctx, c = GN.canvas; if (!ctx) return; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); GN.strokes.forEach(s => gnStrokeDraw(s, 0)); }
const gnSafeColor = c => /^#[0-9a-f]{6}$/i.test(String(c)) ? String(c).toLowerCase() : '#111111';
const gnMid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
// smooth lines: each piece is a curve through the midpoints, so the drawing looks hand-made instead of jagged
function gnStrokeDraw(s, from, tailOnly) {
  const c = GN.canvas, ctx = GN.ctx; if (!ctx || !s || !Array.isArray(s.p) || !s.p.length) return;
  const W = c.width, H = c.height, p = s.p;
  ctx.strokeStyle = gnSafeColor(s.c); ctx.fillStyle = gnSafeColor(s.c); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, Math.min(GN_MAX_W / 800, Number(s.w) || 0.008) * W);
  if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0] * W, p[0][1] * H, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.beginPath();
  if (!tailOnly) for (let i = Math.max(1, from); i < p.length; i++) {
    const a = i === 1 ? p[0] : gnMid(p[i - 2], p[i - 1]), q = p[i - 1], e = gnMid(p[i - 1], p[i]);
    ctx.moveTo(a[0] * W, a[1] * H); ctx.quadraticCurveTo(q[0] * W, q[1] * H, e[0] * W, e[1] * H);
  }
  if (s.done || tailOnly) { const a = gnMid(p[p.length - 2], p[p.length - 1]), e = p[p.length - 1]; ctx.moveTo(a[0] * W, a[1] * H); ctx.lineTo(e[0] * W, e[1] * H); }
  ctx.stroke();
}
function gnEndStroke(s) { if (s && !s.done) { s.done = true; if (s.p.length > 1) gnStrokeDraw(s, 0, true); } }
function gnCanDraw() { const st = GN.st, d = st && st.d; return !!(st && st.phase === 'play' && st.game === 'draw' && d && d.phase === 'draw' && d.drawer === gnMeId()); }
function gnPt(e) { const r = GN.canvas.getBoundingClientRect(); const f = v => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000; return [f((e.clientX - r.left) / r.width), f((e.clientY - r.top) / r.height)]; }
function gnStartStroke(pt) {
  const s = { c: GN.tool.erase ? '#ffffff' : GN.tool.c, w: GN.tool.w / 800, p: [pt] };
  GN.strokes.push(s); GN.cur = s; gnStrokeDraw(s, 0); GN.out.push({ k: 'b', c: s.c, w: s.w, p: pt });
}
function gnPDown(e) {
  if (!gnCanDraw()) return; e.preventDefault();
  try { GN.canvas.setPointerCapture(e.pointerId); } catch (x) {}
  gnStartStroke(gnPt(e)); gnBrushAt(e);
}
function gnPMove(e) {
  gnBrushAt(e);
  if (!GN.cur) return; e.preventDefault();
  const pt = gnPt(e), l = GN.cur.p[GN.cur.p.length - 1]; if (Math.abs(pt[0] - l[0]) + Math.abs(pt[1] - l[1]) < 0.005) return;   // skip tiny moves: fewer points, same look
  GN.cur.p.push(pt); gnStrokeDraw(GN.cur, GN.cur.p.length - 1);
  const last = GN.out[GN.out.length - 1]; if (last && last.k === 'm') last.p.push(pt); else GN.out.push({ k: 'm', p: [pt] });
}
function gnPUp() { if (GN.cur) { gnEndStroke(GN.cur); GN.out.push({ k: 'e' }); } GN.cur = null; }
// a circle under the pointer shows the brush: its size and colour, or an outline for the eraser
function gnBrushAt(e) {
  const el = GN.brushEl; if (!el) return;
  if (!gnCanDraw() || e.pointerType === 'touch') { el.classList.add('hidden'); return; }
  const r = GN.wrap.getBoundingClientRect(), d = Math.max(4, GN.tool.w / 800 * r.width);
  el.style.width = el.style.height = d + 'px'; el.style.left = (e.clientX - r.left) + 'px'; el.style.top = (e.clientY - r.top) + 'px';
  el.style.background = GN.tool.erase ? 'transparent' : GN.tool.c; el.style.boxShadow = GN.tool.erase ? '0 0 0 1.5px #111' : '0 0 0 1.5px rgba(0,0,0,.35)';
  el.classList.remove('hidden');
}
function gnFlush() { if (!GN.out.length || !GN.ch) return; const ops = GN.out; GN.out = []; gnSend({ t: 'draw', ops }); }
function gnApplyOps(ops) {
  ops.slice(0, 400).forEach(o => {
    if (!o) return;
    const okPt = p => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && v >= 0 && v <= 1);
    if (o.k === 'b' && okPt(o.p)) { gnEndStroke(GN.rcur); const s = { c: gnSafeColor(o.c), w: Math.min(GN_MAX_W / 800, Number(o.w) || 0.008), p: [o.p] }; GN.strokes.push(s); GN.rcur = s; gnStrokeDraw(s, 0); }
    else if (o.k === 'm' && GN.rcur && Array.isArray(o.p)) { const pts = o.p.filter(okPt); const n = GN.rcur.p.length; GN.rcur.p.push(...pts); gnStrokeDraw(GN.rcur, n); }
    else if (o.k === 'e') { gnEndStroke(GN.rcur); GN.rcur = null; }
    else if (o.k === 'u') { GN.strokes.pop(); GN.rcur = null; gnRedraw(); }
    else if (o.k === 'x') { GN.strokes = []; GN.rcur = null; gnRedraw(); }
  });
}
// colour and size can change at any moment, even in the middle of a line: the line simply carries on in the new style
function gnTool(k, v) {
  const before = { c: GN.tool.c, w: GN.tool.w, erase: GN.tool.erase };
  if (k === 'c') { GN.tool.c = gnSafeColor(v); GN.tool.erase = false; }
  if (k === 'w') GN.tool.w = Math.max(GN_MIN_W, Math.min(GN_MAX_W, Math.round(Number(v) || 7)));
  if (k === 'erase') GN.tool.erase = !GN.tool.erase;
  if (k === 'brush') GN.tool.erase = false;
  if (k === 'undo' && gnCanDraw() && GN.strokes.length) { if (GN.cur) gnPUp(); GN.strokes.pop(); gnRedraw(); GN.out.push({ k: 'u' }); }
  if (k === 'clear' && gnCanDraw()) { GN.cur = null; GN.strokes = []; gnRedraw(); GN.out.push({ k: 'x' }); }
  const changed = before.c !== GN.tool.c || before.w !== GN.tool.w || before.erase !== GN.tool.erase;
  if (changed && GN.cur && gnCanDraw()) { const last = GN.cur.p[GN.cur.p.length - 1]; gnPUp(); gnStartStroke(last); }
  try { localStorage.setItem('gn_tool', JSON.stringify({ c: GN.tool.c, w: GN.tool.w })); } catch (e) {}
  gnToolsSync();
}
// update the toolbar in place (re-building it would interrupt a slider or colour picker that is being dragged)
function gnToolsSync() {
  const tb = document.getElementById('gnTools'); if (!tb) return;
  const t = GN.tool, inPalette = GN_COLORS.includes(t.c);
  tb.querySelectorAll('[data-color]').forEach(b => { const on = !t.erase && b.dataset.color === t.c; b.classList.toggle('ring-white', on); b.classList.toggle('scale-110', on); b.classList.toggle('ring-white/15', !on); });
  const cust = document.getElementById('gnCustom'); if (cust) { const on = !t.erase && !inPalette; cust.classList.toggle('ring-white', on); cust.classList.toggle('scale-110', on); cust.classList.toggle('ring-white/15', !on); const inp = cust.querySelector('input'); if (inp && document.activeElement !== inp) inp.value = t.c; }
  const dot = document.getElementById('gnBrushDot'); if (dot) { const d = Math.max(3, Math.min(28, t.w)); dot.style.width = dot.style.height = d + 'px'; dot.style.background = t.erase ? 'transparent' : t.c; dot.style.boxShadow = t.erase ? 'inset 0 0 0 1.5px #111' : (t.c === '#ffffff' ? 'inset 0 0 0 1px #9ca3af' : 'none'); }
  const val = document.getElementById('gnSizeVal'); if (val) val.textContent = t.w;
  const sl = document.getElementById('gnSize'); if (sl && document.activeElement !== sl) sl.value = t.w;
  tb.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('bg-white/20', Number(b.dataset.size) === t.w));
  const er = document.getElementById('gnEraser'); if (er) { er.classList.toggle('bg-white', t.erase); er.classList.toggle('text-black', t.erase); er.classList.toggle('bg-white/[0.06]', !t.erase); }
}
function gdToolsHtml() {
  const t = GN.tool;
  const colors = GN_COLORS.map(c => `<button type="button" data-color="${c}" onclick="gnTool('c','${c}')" aria-label="Colour ${c}" class="h-[22px] w-[22px] shrink-0 rounded-full ring-2 ring-white/15 transition sm:h-7 sm:w-7" style="background:${c}"></button>`).join('');
  const custom = `<label id="gnCustom" title="Pick any colour" class="relative h-[22px] w-[22px] shrink-0 cursor-pointer overflow-hidden rounded-full ring-2 ring-white/15 transition sm:h-7 sm:w-7" style="background:conic-gradient(#ef4444,#facc15,#22c55e,#06b6d4,#3b82f6,#a855f7,#ec4899,#ef4444)"><input type="color" value="${gnSafeColor(t.c)}" oninput="gnTool('c', this.value)" aria-label="Pick any colour" class="absolute inset-0 h-full w-full cursor-pointer opacity-0"></label>`;
  const presets = [[4, 'S'], [10, 'M'], [22, 'L']].map(([w, l]) => `<button type="button" data-size="${w}" onclick="gnTool('w',${w})" aria-label="Brush size ${l}" class="hidden h-8 w-8 shrink-0 rounded-lg bg-white/[0.06] text-xs font-semibold text-white/80 sm:block">${l}</button>`).join('');
  const btn = (k, icon, label, id) => `<button type="button" ${id ? `id="${id}"` : ''} onclick="gnTool('${k}')" aria-label="${label}" title="${label}" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white"><i class="fa-solid ${icon} text-sm"></i></button>`;
  return `<div id="gnTools" class="flex flex-col items-center gap-2 py-0.5">
    <div class="flex flex-wrap items-center justify-center gap-[5px] sm:gap-1.5">${colors}${custom}</div>
    <div class="flex items-center justify-center gap-1.5">
      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white" title="Current brush"><span id="gnBrushDot" class="rounded-full"></span></span>
      <input id="gnSize" type="range" min="${GN_MIN_W}" max="${GN_MAX_W}" step="1" value="${t.w}" oninput="gnTool('w', this.value)" aria-label="Brush size" class="h-8 w-[88px] accent-purple-400 sm:w-32">
      <span id="gnSizeVal" class="w-5 text-xs tabular-nums text-white/55">${t.w}</span>
      ${presets}
      <span class="mx-1 h-6 w-px shrink-0 bg-white/15"></span>
      ${btn('erase', 'fa-eraser', 'Eraser (E)', 'gnEraser')}${btn('undo', 'fa-rotate-left', 'Undo (Ctrl+Z)')}${btn('clear', 'fa-trash', 'Clear the drawing')}
    </div>
  </div>`;
}
// keyboard: Ctrl+Z undo, B brush, E eraser, [ and ] brush size
document.addEventListener('keydown', e => {
  if (!document.getElementById('gnRoot') || !gnCanDraw()) return;
  const tag = (e.target && e.target.tagName) || ''; if (tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'color' || tag === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); gnTool('undo'); }
  else if (e.key === 'e' || e.key === 'E') gnTool('erase');
  else if (e.key === 'b' || e.key === 'B') gnTool('brush');
  else if (e.key === '[') gnTool('w', GN.tool.w - 2);
  else if (e.key === ']') gnTool('w', GN.tool.w + 2);
});
(function () { try { const s = JSON.parse(localStorage.getItem('gn_tool') || 'null'); if (s) { GN.tool.c = gnSafeColor(s.c); GN.tool.w = Math.max(GN_MIN_W, Math.min(GN_MAX_W, Number(s.w) || 7)); } } catch (e) {} })();

// ---- sounds (short tones made on the device; nothing is downloaded). A button in the top bar mutes them.
const GNS = { ctx: null };
function gnMuted() { try { return localStorage.getItem('gn_mute') === '1'; } catch (e) { return false; } }
function gnToggleMute() { try { localStorage.setItem('gn_mute', gnMuted() ? '0' : '1'); } catch (e) {} const b = document.getElementById('gnMuteBtn'); if (b) b.innerHTML = `<i class="fa-solid ${gnMuted() ? 'fa-volume-xmark' : 'fa-volume-high'} text-[12px]"></i>`; if (!gnMuted()) gnSound('turn'); }
function gnBeep(freq, dur, type, vol, when) {
  if (gnMuted()) return;
  try {
    if (!GNS.ctx) GNS.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const a = GNS.ctx; if (a.state === 'suspended') a.resume();
    const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + (when || 0);
    o.type = type || 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(vol || 0.06, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) {}
}
function gnSound(k) {
  if (k === 'tick') gnBeep(1000, 0.05, 'square', 0.025);
  else if (k === 'correct') { gnBeep(660, 0.12, 'sine', 0.08); gnBeep(990, 0.2, 'sine', 0.08, 0.1); }
  else if (k === 'turn') gnBeep(520, 0.16, 'triangle', 0.06);
  else if (k === 'end') [523, 659, 784, 1046].forEach((f, i) => gnBeep(f, 0.22, 'triangle', 0.07, i * 0.12));
}
// the big round clock next to the word
function gnClockHtml() {
  return `<div class="relative h-12 w-12 shrink-0" aria-label="Time left"><svg viewBox="0 0 36 36" class="h-12 w-12 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3"></circle><circle id="gnClockRing" cx="18" cy="18" r="15.5" fill="none" stroke="#a78bfa" stroke-width="3" stroke-linecap="round" stroke-dasharray="97.4" stroke-dashoffset="0" style="transition:stroke-dashoffset .25s linear, stroke .3s"></circle></svg><span id="gnClockText" class="absolute inset-0 flex items-center justify-center text-[15px] font-bold tabular-nums"></span></div>`;
}

// ================= MOVIE FIBBER =================
const gfKey = st => 'f:' + st.f.round;
function gfFilmPool() {
  const v = m => m.totalVotes || 0;
  return mediaDatabase.filter(m => m.type === 'Movie' && m.poster && m.synopsis && m.synopsis.length > 60 && (m.language === 'en' || dcIsIndian(m)) && v(m) >= 300 && v(m) <= 25000 && gfReal(m));
}
function gfReal(m) {
  const s = String(m.synopsis || '').replace(/\s+/g, ' ').trim();
  const first = (s.match(/^.+?[.!?](?=\s|$)/) || [s])[0];
  if (first.length >= 40 && first.length <= 170) return first;
  if (first.length > 170) { const cut = first.slice(0, 165); const c = cut.lastIndexOf(', '); const out = (c > 60 ? cut.slice(0, c) : cut.replace(/\s+\S*$/, '')).replace(/[,;:\s]+$/, ''); return out + '.'; }
  return null;
}
function gfInit(st) { st.f = { round: 1, used: [] }; gfNew(st); }
function gfNew(st) {
  const f = st.f, pool = gfFilmPool().filter(m => !f.used.includes(m.id));
  const m = pool[gnRand(pool.length)]; if (!m) { gnEnd(st); return; }
  f.used.push(m.id); f.film = gnCompact(m); f.submitted = {}; f.options = null; f.votes = {}; f.gain = {}; f.result = null; f.phase = 'write';
  GN.sec = GN.sec || {}; GN.sec.fib = { k: gfKey(st), real: gfReal(m), fibs: {}, order: [] };
  gnDeadline(st, 75);
}
function gfFib(u, text) {
  const st = GN.st, f = st && st.f, s = GN.sec && GN.sec.fib; if (!f || f.phase !== 'write' || !s || s.k !== gfKey(st)) return;
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 150); if (t.length < 3) return;
  s.fibs[u] = t;
  gnUpdate(st => { st.f.submitted[u] = true; if (gnHereIds().every(x => st.f.submitted[x])) gfToVote(st); });
}
// at least four choices: plots from other films fill in when few fakes came in, so nobody gets a free win
function gfToVote(st) {
  const f = st.f, s = GN.sec && GN.sec.fib; if (!s) { gfNew(st); return; }
  const list = [{ who: 'real', text: s.real }].concat(Object.entries(s.fibs).map(([u, text]) => ({ who: u, text })));
  const decoys = gnShuffle(gfFilmPool().filter(m => m.id !== f.film.id)).slice(0, 8).map(gfReal).filter(t => t && t !== s.real);
  while (list.length < 4 && decoys.length) list.push({ who: 'house', text: decoys.shift() });
  const mixed = gnShuffle(list);
  s.order = mixed.map(x => x.who); s.texts = mixed.map(x => x.text);
  f.options = mixed.map(x => x.text); f.phase = 'vote'; gnDeadline(st, 40);
}
function gfVote(u, k) {
  const st = GN.st, f = st && st.f, s = GN.sec && GN.sec.fib; if (!f || f.phase !== 'vote' || !s || !s.order[k] || s.order[k] === u) return;
  gnUpdate(st => { st.f.votes[u] = k; if (gnHereIds().every(x => st.f.votes[x] != null)) gfReveal(st); });
}
function gfReveal(st) {
  const f = st.f, s = GN.sec && GN.sec.fib; f.gain = {};
  if (!s || !s.order.length) { f.result = []; f.phase = 'reveal'; gnDeadline(st, 8); return; }
  Object.entries(f.votes).forEach(([u, k]) => {
    const who = s.order[k];
    if (who === 'real') { f.gain[u] = (f.gain[u] || 0) + 200; gnAddScore(st, u, 200); }
    else if (who && who !== 'house' && who !== u) { f.gain[who] = (f.gain[who] || 0) + 100; gnAddScore(st, who, 100); }
  });
  f.result = s.order.map((who, k) => ({ who, text: s.texts[k], voters: Object.keys(f.votes).filter(u => f.votes[u] === k) }));
  f.phase = 'reveal'; gnDeadline(st, 14);
}
function gfTick(st) {
  const f = st.f; if (!f) return;
  if (f.phase !== 'reveal' && (!GN.sec || !GN.sec.fib || GN.sec.fib.k !== gfKey(st))) { gnUpdate(st => gfNew(st)); return; }
  if (Date.now() <= st.deadline) return;
  if (f.phase === 'write') gnUpdate(st => gfToVote(st));
  else if (f.phase === 'vote') gnUpdate(st => gfReveal(st));
  else if (f.phase === 'reveal') gnUpdate(st => { if (st.f.round >= st.settings.fibRounds) gnEnd(st); else { st.f.round++; gfNew(st); } });
}

// ================= WHO'S THE IMPOSTOR? =================
const giKey = st => 'i:' + st.i.round + ':' + (st.i.tries || 0);
function giPopular(m) { const v = m.totalVotes || 0; return m.type === 'Movie' && m.poster && ((m.language === 'en' && v >= 6000) || (dcIsIndian(m) && v >= 400)); }
function giInit(st) { st.i = { round: 1, used: [], tries: 0 }; giNew(st); }
function giNew(st) {
  const i = st.i, pool = mediaDatabase.filter(m => giPopular(m) && !i.used.includes(m.id));
  let A = null, B = null;
  for (let tries = 0; tries < 40 && !B; tries++) {
    A = pool[gnRand(pool.length)]; if (!A) break;
    let sims = []; try { sims = dcSimilar(A, 6, 10); } catch (e) {}
    B = sims.find(x => giPopular(x) && gnNorm(x.title) !== gnNorm(A.title)) || null;      // the impostor's film is well known too
  }
  if (!A || !B) { gnEnd(st); return; }
  const here = gnHereIds(), imp = here[gnRand(here.length)];
  i.tries = (i.tries || 0) + 1; i.used.push(A.id);
  i.order = gnShuffle(here); i.turn = 0; i.lap = 1; i.clues = []; i.votes = {}; i.guessOpts = null; i.imp = null; i.result = null; i.gain = {}; i.phase = 'clue';
  GN.sec = GN.sec || {}; GN.sec.imp = { k: giKey(st), A: gnCompact(A), B: gnCompact(B), imp, guess: null };
  gnDeadline(st, 30);
  const sec = GN.sec.imp;
  setTimeout(() => here.forEach(u => gnSendSecret(u, { k: sec.k, film: u === imp ? sec.B : sec.A })), 0);
}
function giTitleWords(f) { return String(f.title).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !['the', 'and', 'for', 'with', 'from'].includes(w)); }
function giClue(u, text) {
  const st = GN.st, i = st && st.i, s = GN.sec && GN.sec.imp; if (!i || i.phase !== 'clue' || i.order[i.turn] !== u || !s) return;
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 30); if (!t) return;
  const words = new Set(t.toLowerCase().split(/[^a-z0-9]+/));
  if (giTitleWords(s.A).concat(giTitleWords(s.B)).some(w => words.has(w))) { gnSend({ t: 'note', to: u, text: 'That clue uses a word from the film\'s title. Try another one.' }); return; }
  gnUpdate(st => { st.i.clues.push({ u, text: t, lap: st.i.lap }); giAdvance(st); });
}
function giAdvance(st) {
  const i = st.i;
  do { i.turn++; if (i.turn >= i.order.length) { i.turn = 0; i.lap++; } } while (i.lap <= st.settings.impLaps && !gnHere(i.order[i.turn]));
  if (i.lap > st.settings.impLaps) { i.phase = 'vote'; gnDeadline(st, 60); } else gnDeadline(st, 30);
}
function giVote(u, target) {
  const st = GN.st, i = st && st.i; if (!i || i.phase !== 'vote' || target === u || !(st.joined || []).includes(target)) return;
  gnUpdate(st => { st.i.votes[u] = target; if (gnHereIds().every(x => st.i.votes[x] != null)) giTally(st); });
}
function giTally(st) {
  const i = st.i, s = GN.sec.imp, n = {}; Object.values(i.votes).forEach(t => { n[t] = (n[t] || 0) + 1; });
  const max = Math.max(0, ...Object.values(n)), top = Object.keys(n).filter(k => n[k] === max);
  const caught = max > 0 && top.length === 1 && top[0] === s.imp, tie = max > 0 && top.length > 1;
  if (caught) {
    let others = []; try { others = dcSimilar(mediaDatabase.find(m => m.id === s.A.id), 6, 10); } catch (e) {}
    i.guessOpts = gnShuffle([s.A].concat(others.filter(x => x.id !== s.B.id && x.id !== s.A.id).slice(0, 3).map(gnCompact)));
    i.imp = s.imp; i.phase = 'guess'; gnDeadline(st, 25);
  } else giReveal(st, { caught: false, tie });
}
function giGuess(u, id) {
  const st = GN.st, i = st && st.i, s = GN.sec && GN.sec.imp; if (!i || i.phase !== 'guess' || !s || u !== s.imp) return;
  s.guess = String(id); gnUpdate(st => giReveal(st, { caught: true }));
}
function giReveal(st, o) {
  const i = st.i, s = GN.sec && GN.sec.imp; i.gain = {};
  if (!s) { i.phase = 'reveal'; i.result = null; gnDeadline(st, 6); return; }
  const add = (u, p) => { i.gain[u] = (i.gain[u] || 0) + p; gnAddScore(st, u, p); };
  if (o.left) { /* the impostor left: nobody scores this round */ }
  else if (o.caught) { Object.entries(i.votes).forEach(([u, t]) => { if (t === s.imp) add(u, 100); }); if (s.guess === s.A.id) add(s.imp, 150); }
  else { add(s.imp, 300); Object.entries(i.votes).forEach(([u, t]) => { if (t === s.imp) add(u, 50); }); }   // a small reward for those who did spot them
  i.imp = s.imp;
  i.result = { A: s.A, B: s.B, imp: s.imp, caught: !!o.caught, tie: !!o.tie, left: !!o.left, guessed: o.caught ? s.guess === s.A.id : null, guessMade: !!s.guess };
  i.phase = 'reveal'; gnDeadline(st, 14);
}
function giTick(st) {
  const i = st.i; if (!i) return;
  const s = GN.sec && GN.sec.imp;
  if (i.phase !== 'reveal' && (!s || s.k !== giKey(st))) { gnUpdate(st => giNew(st)); return; }
  if (i.phase !== 'reveal' && s && !gnHere(s.imp)) { gnUpdate(st => giReveal(st, { left: true })); gnBroadcastSys(`${gnName(s.imp)} was the impostor and left the room, so this round is over.`); return; }
  if (i.phase === 'clue' && !gnHere(i.order[i.turn])) { gnUpdate(st => giAdvance(st)); return; }
  if (Date.now() <= st.deadline) return;
  if (i.phase === 'clue') gnUpdate(st => { st.i.clues.push({ u: st.i.order[st.i.turn], text: '(no clue)', lap: st.i.lap, miss: true }); giAdvance(st); });
  else if (i.phase === 'vote') gnUpdate(st => giTally(st));
  else if (i.phase === 'guess') gnUpdate(st => giReveal(st, { caught: true }));
  else if (i.phase === 'reveal') gnUpdate(st => { if (st.i.round >= st.settings.impRounds) gnEnd(st); else { st.i.round++; st.i.tries = 0; giNew(st); } });
}

// ================= SCREEN =================
function gnRender(full) {
  const r = document.getElementById('gnRoot'); if (!r) return;
  if (!GN.code) { r.innerHTML = gnLandingHtml(); return; }
  if (full || !document.getElementById('gnStage')) {
    r.innerHTML = gnShellHtml(); gnFeedRender(); GN.stageKey = '';
    if ('ResizeObserver' in window) new ResizeObserver(() => gnFitBoard()).observe(document.getElementById('gnStage'));
  }
  gnRenderTop(); gnRenderPlayers(); gnRenderStage(); gnRenderChatInput();
}
function gnLandingHtml() {
  const code = GN.joinCode || '';
  const card = g => `<div class="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08]"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-200"><i class="fa-solid ${GN_GAMES[g].icon}"></i></span><div><div class="font-medium text-white">${GN_GAMES[g].name}</div><div class="mt-0.5 text-sm leading-snug text-white/55">${GN_GAMES[g].desc}</div></div></div>`;
  return `
    <div class="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4"><div class="font-display text-xl">Game night</div><button type="button" onclick="closeGames()" class="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/80 hover:bg-white/10" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-10">
        <div><h1 class="font-display text-3xl sm:text-4xl">Play movie games with friends</h1><p class="mt-2 text-white/55">Start a room, send the link, and play together live on phones or computers. No sign-in needed. Use a call or WhatsApp to talk while you play.</p></div>
        <div class="space-y-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
          <label class="block text-sm text-white/70">Your name<input id="gnNameInput" maxlength="16" value="${esc(gnSavedName())}" placeholder="e.g. Rahul" autocomplete="nickname" class="mt-1.5 w-full rounded-xl bg-white/[0.06] px-4 py-3 text-base text-white ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-white/30"></label>
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
      <button type="button" id="gnMuteBtn" onclick="gnToggleMute()" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/80 hover:bg-white/10" aria-label="Sound on or off"><i class="fa-solid ${gnMuted() ? 'fa-volume-xmark' : 'fa-volume-high'} text-[12px]"></i></button>
      <button type="button" onclick="closeGames()" class="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs text-white/80 hover:bg-rose-500/20" aria-label="Leave the room"><i class="fa-solid fa-right-from-bracket text-[11px]"></i><span class="hidden sm:inline">Leave</span></button>
    </div>
    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside id="gnPlayers" class="no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 px-3 py-2 lg:w-60 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-3"></aside>
      <div class="flex min-h-0 flex-1 flex-col md:flex-row">
      <main id="gnStage" class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"></main>
      <section id="gnChatBox" class="flex h-[30vh] shrink-0 flex-col border-t border-white/10 md:h-auto md:w-72 md:border-l md:border-t-0 lg:w-80">
        <div id="gnFeed" class="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm"></div>
        <form onsubmit="gnSubmitChat(event)" class="flex gap-2 border-t border-white/10 p-2">
          <input id="gnChatInput" maxlength="80" autocomplete="off" enterkeyhint="send" class="min-w-0 flex-1 rounded-full bg-white/[0.06] px-4 py-2.5 text-[15px] text-white ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-white/30">
          <button type="submit" class="rounded-full bg-white px-4 text-sm font-semibold text-black" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
        </form>
      </section>
      </div>
    </div>`;
}
function gnRenderTop() {
  const el = document.getElementById('gnTop'); if (!el) return;
  const st = GN.st; let txt;
  if (st && st.phase === 'play') {
    const r = st.game === 'draw' && st.d ? `Round ${Math.min(st.d.round, st.settings.rounds)}/${st.settings.rounds}` : st.game === 'fib' && st.f ? `Round ${st.f.round}/${st.settings.fibRounds}` : st.i ? `Round ${st.i.round}/${st.settings.impRounds}` : '';
    txt = `<span class="hidden text-white/55 sm:inline">${esc(GN_GAMES[st.game].name)} ·</span><span class="text-white/70">${r}</span><span id="gnTimer" class="w-9 text-right font-semibold tabular-nums"></span>`;
  } else txt = `<span class="text-white/55">${GN.members.length} player${GN.members.length === 1 ? '' : 's'}</span>`;
  el.innerHTML = txt; gnTick();
}
function gnRenderPlayers() {
  const el = document.getElementById('gnPlayers'); if (!el) return;
  const st = GN.st, me = gnMeId(), inGame = st && (st.phase === 'play' || st.phase === 'end'), host = gnHostId();
  const score = u => inGame ? (st.scores[u] || 0) : ((st && st.total[u]) || 0);
  const list = GN.members.slice().sort((a, b) => score(b.id) - score(a.id));
  const d = st && st.phase === 'play' && st.game === 'draw' ? st.d : null;
  el.innerHTML = list.map((m, k) => {
    const badge = d && d.drawer === m.id ? '<i class="fa-solid fa-pencil text-[11px] text-amber-300" title="Drawing"></i>' : d && d.guessed && d.guessed[m.id] != null ? '<i class="fa-solid fa-check text-[11px] text-green-400" title="Guessed"></i>' : gnDone(m.id) ? '<i class="fa-solid fa-check text-[11px] text-green-400" title="Done"></i>' : '';
    const gain = gnGain(m.id);
    return `<div class="flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 ${m.id === me ? 'bg-white/[0.09]' : 'bg-white/[0.03]'} ${m.away ? 'opacity-60' : ''} ring-1 ring-white/[0.06] lg:w-full">
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black" style="background:${gnColorOf(m.id)}">${esc(gnName(m.id).slice(0, 1).toUpperCase())}</span>
      <span class="min-w-0"><span class="flex items-center gap-1.5 text-[13px] font-medium leading-tight"><span class="max-w-[90px] truncate lg:max-w-[120px]">${esc(gnName(m.id))}</span>${m.id === me ? '<span class="text-white/40">(you)</span>' : ''}${host === m.id ? '<i class="fa-solid fa-crown text-[10px] text-amber-300" title="Host"></i>' : ''}${badge}</span><span class="block text-[11px] tabular-nums text-white/50">${score(m.id)} pts${gain ? ` <span class="text-green-400">+${gain}</span>` : ''}${m.away ? ' · away' : ''}</span></span>
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
  if (st.game === 'fib' && st.f) return (st.f.phase === 'write' && !!st.f.submitted[u]) || (st.f.phase === 'vote' && st.f.votes[u] != null);
  if (st.game === 'imp' && st.i) return st.i.phase === 'vote' && st.i.votes[u] != null;
  return false;
}
function gnTimeBar() { return '<div class="h-1 overflow-hidden rounded-full bg-white/10"><div id="gnTimeBar" class="h-full rounded-full bg-gradient-to-r from-purple-400 to-blue-400 transition-[width] duration-200 ease-linear" style="width:100%"></div></div>'; }
function gnPoster(f, cls) { return f && /^https:\/\/image\.tmdb\.org\//.test(String(f.poster || '')) ? `<img src="${esc(typeof ps === 'function' ? ps(f.poster) : f.poster)}" alt="" class="${cls || 'h-24 w-16'} shrink-0 rounded-lg object-cover ring-1 ring-white/15">` : ''; }

function gnRenderStage(force) {
  const el = document.getElementById('gnStage'); if (!el) return;
  const st = GN.st;
  // while a drawing is on screen, refresh only the word line: re-building would interrupt the pen mid-stroke
  const key = st && st.phase === 'play' && st.game === 'draw' && st.d ? gdKey(st) + ':' + st.d.phase : '';
  if (!force && key && key === GN.stageKey && st.d.phase === 'draw' && document.getElementById('gnCanvasWrap')) {
    const w = document.getElementById('gnWordTop'); if (w) w.innerHTML = gdTopHtml(st);
    const h = document.getElementById('gnHint'); if (h) h.classList.toggle('hidden', !(st.d.drawer !== gnMeId() && st.d.guessed[gnMeId()] == null));
    return;
  }
  if (force && key && key === GN.stageKey && st.d.phase === 'draw' && document.getElementById('gnCanvasWrap')) { const w = document.getElementById('gnWordTop'); if (w) w.innerHTML = gdTopHtml(st); return; }
  GN.stageKey = key;
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
  if (slot) { slot.appendChild(gnCanvasWrap()); requestAnimationFrame(() => { gnFitBoard(); gnResize(); }); }
  gnToolsSync();
  gnTick();
}
function gnLobbyHtml(st) {
  const host = gnIsHost(), g = st.game, s = st.settings;
  const cards = Object.keys(GN_GAMES).map(k => `<button type="button" ${host ? `data-act="game" data-v="${k}"` : 'disabled'} class="flex items-start gap-3 rounded-2xl p-4 text-left ring-1 transition ${g === k ? 'bg-purple-500/15 ring-purple-400/50' : 'bg-white/[0.03] ring-white/[0.08] ' + (host ? 'hover:bg-white/[0.06]' : '')}"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${g === k ? 'bg-purple-400 text-black' : 'bg-white/10 text-white/80'}"><i class="fa-solid ${GN_GAMES[k].icon}"></i></span><span><span class="block font-medium text-white">${GN_GAMES[k].name}</span><span class="mt-0.5 block text-[13px] leading-snug text-white/55">${GN_GAMES[k].desc}</span><span class="mt-1 block text-xs text-white/35">${GN_GAMES[k].min}+ players</span></span></button>`).join('');
  const sel = (k, opts) => host ? `<select onchange="gnSetting('${k}', this.value)" class="rounded-full bg-white/[0.06] px-3 py-2 text-sm text-white ring-1 ring-white/10">${opts.map(([v, l]) => `<option value="${v}" class="bg-[#14141A]" ${String(s[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>` : `<span class="rounded-full bg-white/[0.04] px-3 py-2 text-sm text-white/70">${(opts.find(([v]) => String(v) === String(s[k])) || [0, ''])[1]}</span>`;
  const settings = g === 'draw' ? `${sel('rounds', [[2, '2 rounds'], [3, '3 rounds'], [4, '4 rounds'], [5, '5 rounds']])}${sel('drawSec', [[60, '60 s to draw'], [80, '80 s to draw'], [100, '100 s to draw'], [120, '120 s to draw']])}${sel('pool', [['mix', 'Hollywood + Indian'], ['hw', 'Hollywood only'], ['in', 'Indian only']])}`
    : g === 'fib' ? sel('fibRounds', [[3, '3 rounds'], [4, '4 rounds'], [5, '5 rounds'], [6, '6 rounds']])
    : `${sel('impRounds', [[2, '2 rounds'], [3, '3 rounds'], [4, '4 rounds'], [5, '5 rounds']])}${sel('impLaps', [[1, '1 clue each'], [2, '2 clues each'], [3, '3 clues each']])}`;
  const n = gnHereIds().length, need = GN_GAMES[g].min;
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
      <div class="flex items-center gap-2 border-t border-white/10 pt-4 text-sm"><span class="text-white/50">Your name</span><input id="gnRenameInput" data-keep maxlength="16" value="${esc(GN.me ? GN.me.name : '')}" class="w-36 rounded-full bg-white/[0.06] px-3 py-1.5 text-white ring-1 ring-white/10 focus:outline-none focus:ring-white/30"><button type="button" onclick="gnRename()" class="rounded-full px-3 py-1.5 text-white/80 ring-1 ring-white/15 hover:bg-white/10">Save</button></div>
    </div>`;
}
function gnEndHtml(st) {
  const ranked = Object.entries(st.scores || {}).sort((a, b) => b[1] - a[1]);
  const medal = ['🥇', '🥈', '🥉'];
  const rows = ranked.map(([u, v], k) => `<div class="flex items-center gap-3 rounded-xl px-4 py-3 ${k === 0 ? 'bg-amber-400/15 ring-1 ring-amber-300/30' : 'bg-white/[0.04]'}"><span class="w-7 text-center text-xl">${medal[k] || '#' + (k + 1)}</span><span class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-black" style="background:${gnColorOf(u)}">${esc(gnName(u).slice(0, 1).toUpperCase())}</span><span class="min-w-0 flex-1 truncate font-medium">${esc(gnName(u))}</span><span class="font-semibold tabular-nums">${Number(v) || 0}</span></div>`).join('');
  const host = gnIsHost();
  return `
    <div class="mx-auto max-w-xl space-y-5 text-center">
      <div><div class="text-xs uppercase tracking-[0.16em] text-purple-300/80">${esc(GN_GAMES[st.game].name)} · game over</div><h2 class="mt-1 font-display text-3xl">${ranked.length ? esc(gnName(ranked[0][0])) + ' wins!' : 'Game over'}</h2></div>
      <div class="space-y-2 text-left">${rows}</div>
      ${host ? `<div class="flex flex-col gap-2 sm:flex-row sm:justify-center"><button type="button" onclick="gnStart(GN.st.game)" class="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black">Play again</button><button type="button" onclick="gnToLobby()" class="rounded-full px-8 py-3 text-sm text-white ring-1 ring-white/20">Choose another game</button></div>` : '<div class="text-sm text-white/55">Waiting for the host to start the next game.</div>'}
    </div>`;
}
function gdTopHtml(st) { const d = st.d, me = gnMeId(); return d.drawer === me ? `<span class="text-xs uppercase tracking-wider text-white/50">Draw</span> ${gdMaskHtml(st)}` : gdMaskHtml(st); }
function gdStageHtml(st) {
  const d = st.d, me = gnMeId(); if (!d) return '';
  const drawer = gnName(d.drawer), amDrawer = d.drawer === me, mine = gnMine('d', gdKey(st));
  let top, body;
  if (d.phase === 'choose') {
    top = amDrawer ? '<span class="font-semibold text-white">Your turn! Pick a film to draw</span>' : `<span class="text-white/75"><b class="text-white">${esc(drawer)}</b> is choosing a film…</span>`;
    const choices = mine && mine.choices;
    body = amDrawer ? (choices ? `<div class="grid grid-cols-3 gap-2 sm:gap-4">${choices.map((c, i) => `<button type="button" data-act="pick" data-v="${i}" class="group overflow-hidden rounded-xl bg-white/[0.05] text-left ring-1 ring-white/10 transition active:scale-[.98] sm:hover:ring-white/40">${gnPoster(c, 'aspect-[2/3] w-full')}<span class="block p-2 text-[13px] font-semibold leading-tight sm:text-sm">${esc(c.title)}</span><span class="block px-2 pb-2 text-[11px] text-white/45">${esc(c.year)}</span></button>`).join('')}</div>` : '<div class="py-16 text-center text-white/50">Getting your films…</div>')
      : '<div class="flex aspect-[4/3] items-center justify-center rounded-xl bg-white/[0.04] text-white/50"><i class="fa-solid fa-paintbrush mr-2"></i>Get ready to guess</div>';
  } else {
    top = gdTopHtml(st);
    const n = Object.keys(d.guessed).length;
    const reveal = d.phase === 'reveal' ? `<div class="absolute inset-0 z-10 flex items-center justify-center bg-black/75 p-4"><div class="flex items-center gap-4 text-left">${gnPoster(d.word, 'h-32 w-[86px] sm:h-40 sm:w-[106px]')}<div><div class="text-xs uppercase tracking-[0.16em] text-white/55">The film was</div><div class="font-display text-2xl sm:text-3xl">${esc(d.word ? d.word.title : '')}</div><div class="text-sm text-white/60">${esc(d.word ? d.word.year : '')}</div><div class="mt-2 text-sm ${n ? 'text-green-400' : 'text-rose-300'}">${n ? n + ' guessed it' : 'Nobody guessed it'}</div></div></div></div>` : '';
    body = `<div id="gnBoardBox" class="relative mx-auto w-full max-w-full">${reveal}<div id="gnCanvasSlot"></div></div>${amDrawer && d.phase === 'draw' ? gdToolsHtml() : ''}`;
  }
  return `<div id="gnDrawBox" class="mx-auto flex max-w-[880px] flex-col gap-2">
    <div class="flex items-center justify-center gap-3"><div id="gnWordTop" class="flex min-h-[40px] min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">${top}</div>${d.phase === 'reveal' ? '' : gnClockHtml()}</div>
    ${body}
    <div id="gnHint" class="text-center text-xs text-white/40 ${!amDrawer && d.phase === 'draw' && d.guessed[me] == null ? '' : 'hidden'}">Type your guess in the chat. Faster guesses score more.</div>
  </div>`;
}
function gfStageHtml(st) {
  const f = st.f, me = gnMeId(); if (!f) return '';
  const film = `<div class="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08] sm:p-4">${gnPoster(f.film, 'h-24 w-16 sm:h-28 sm:w-[76px]')}<div class="min-w-0"><div class="text-xs uppercase tracking-[0.16em] text-white/50">The film</div><div class="font-display text-2xl leading-tight">${esc(f.film.title)}</div><div class="text-sm text-white/55">${esc(f.film.year)}${f.film.genres.length ? ' · ' + esc(f.film.genres.join(' · ')) : ''}</div></div></div>`;
  let body = '';
  const myFib = GN.myFib && GN.myFib.k === gfKey(st) ? GN.myFib.text : null;
  if (f.phase === 'write') {
    body = f.submitted[me] ? `<div class="rounded-2xl bg-green-500/10 p-4 text-sm ring-1 ring-green-400/25"><div class="text-green-300">Your fake plot is in.</div>${myFib ? `<div class="mt-1 text-white/80">“${esc(myFib)}”</div>` : ''}<div class="mt-2 text-white/50">Waiting for the others (${Object.keys(f.submitted).length}/${gnHereIds().length})…</div></div>`
      : `<div class="space-y-2"><div class="text-sm text-white/70">Write a <b class="text-white">fake plot</b> for this film, one sentence that sounds real. Others will try to spot the real one.</div><textarea id="gnFibText" data-keep maxlength="150" rows="3" placeholder="e.g. A retired chef must win one last cooking contest to save his village." class="w-full rounded-2xl bg-white/[0.06] p-4 text-[15px] text-white ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-white/30"></textarea><button type="button" onclick="gfSubmit()" class="w-full rounded-full bg-white py-3 text-sm font-semibold text-black sm:w-auto sm:px-8">Submit my fake plot</button></div>`;
  } else if (f.phase === 'vote') {
    const mineVote = f.votes[me];
    body = `<div class="text-sm text-white/70">Which one is the <b class="text-white">real plot</b>? ${mineVote != null ? '<span class="text-green-300">Vote in. You can still change it.</span>' : ''}</div><div class="grid gap-2">${(f.options || []).map((text, k) => text === myFib ? '' : `<button type="button" data-act="fvote" data-v="${k}" class="rounded-2xl px-4 py-3 text-left text-[15px] leading-snug ring-1 transition ${mineVote === k ? 'bg-purple-500/25 ring-purple-300/60' : 'bg-white/[0.05] ring-white/10 active:scale-[.99] sm:hover:bg-white/[0.09]'}">${esc(text)}</button>`).join('')}</div>`;
  } else {
    body = `<div class="grid gap-2">${(f.result || []).map(o => { const real = o.who === 'real'; const label = real ? 'THE REAL PLOT' : o.who === 'house' ? 'A plot from another film' : 'Fake by ' + esc(gnName(o.who)); return `<div class="rounded-2xl p-4 ring-1 ${real ? 'bg-green-500/15 ring-green-400/40' : 'bg-white/[0.04] ring-white/10'}"><div class="text-[15px] leading-snug">${esc(o.text)}</div><div class="mt-2 flex flex-wrap items-center gap-2 text-xs"><span class="${real ? 'font-semibold text-green-300' : 'text-white/55'}">${label}</span>${o.voters.length ? '<span class="text-white/40">· picked by</span>' + o.voters.map(u => `<span class="rounded-full bg-white/10 px-2 py-0.5">${esc(gnName(u))}</span>`).join('') : '<span class="text-white/35">· nobody picked it</span>'}</div></div>`; }).join('')}</div>`;
  }
  return `<div class="mx-auto max-w-2xl space-y-3">${gnTimeBar()}${film}${body}</div>`;
}
function gfSubmit() {
  const el = document.getElementById('gnFibText'); const t = el ? el.value.replace(/\s+/g, ' ').trim().slice(0, 150) : '';
  if (t.length < 3) { showToast('Write a short fake plot first'); return; }
  GN.myFib = { k: gfKey(GN.st), text: t }; gnDo('fib', { text: t });
}
function giStageHtml(st) {
  const i = st.i, me = gnMeId(); if (!i) return '';
  const mine = gnMine('i', giKey(st)), myFilm = mine && mine.film;
  const card = (f, label, cls) => f ? `<div class="flex items-center gap-3 rounded-2xl p-3 ring-1 ${cls || 'bg-white/[0.04] ring-white/[0.08]'}">${gnPoster(f, 'h-20 w-14')}<div class="min-w-0"><div class="text-xs uppercase tracking-[0.14em] text-white/50">${label}</div><div class="font-display text-xl leading-tight">${esc(f.title)}</div><div class="text-xs text-white/50">${esc(f.year)}</div></div></div>` : `<div class="rounded-2xl bg-white/[0.04] p-4 text-sm text-white/50">${label}: getting your film…</div>`;
  const clues = i.clues.length ? `<div class="space-y-1.5">${i.clues.map(c => `<div class="flex items-center gap-2 text-sm"><span class="h-2 w-2 shrink-0 rounded-full" style="background:${gnColorOf(c.u)}"></span><span class="w-24 shrink-0 truncate text-white/60">${esc(gnName(c.u))}</span><span class="${c.miss ? 'text-white/35' : 'font-medium text-white'}">${esc(c.text)}</span></div>`).join('')}</div>` : '';
  let body = '';
  if (i.phase === 'clue') {
    const who = i.order[i.turn], myTurn = who === me;
    body = `<div class="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]"><div class="mb-2 text-sm text-white/70">Clue ${i.lap}/${st.settings.impLaps}: ${myTurn ? '<b class="text-white">your turn.</b> Give one word or a short hint about your film, without words from its title. Don\'t make it too obvious!' : `<b class="text-white">${esc(gnName(who))}</b> is thinking of a clue…`}</div>${myTurn ? `<div class="flex gap-2"><input id="gnClueInput" data-keep maxlength="30" placeholder="One word or a short hint" class="min-w-0 flex-1 rounded-full bg-white/[0.06] px-4 py-3 text-[15px] text-white ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-white/30" onkeydown="if(event.key==='Enter')giSubmitClue()"><button type="button" onclick="giSubmitClue()" class="rounded-full bg-white px-5 text-sm font-semibold text-black">Send</button></div>` : ''}${clues ? '<div class="mt-3 border-t border-white/10 pt-3">' + clues + '</div>' : ''}</div>`;
  } else if (i.phase === 'vote') {
    const mineVote = i.votes[me];
    body = `<div class="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">${clues}</div><div class="text-sm text-white/70">Who is the <b class="text-white">impostor</b>? Discuss in the chat, then vote. ${mineVote ? '<span class="text-green-300">Vote in.</span>' : ''}</div><div class="grid grid-cols-2 gap-2 sm:grid-cols-3">${GN.members.filter(m => m.id !== me && (st.joined || []).includes(m.id)).map(m => `<button type="button" data-act="ivote" data-v="${m.id}" class="flex items-center gap-2 rounded-2xl px-3 py-3 text-left ring-1 transition ${mineVote === m.id ? 'bg-rose-500/25 ring-rose-300/60' : 'bg-white/[0.05] ring-white/10 active:scale-[.98]'}"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black" style="background:${gnColorOf(m.id)}">${esc(gnName(m.id).slice(0, 1).toUpperCase())}</span><span class="truncate text-sm font-medium">${esc(gnName(m.id))}</span></button>`).join('')}</div>`;
  } else if (i.phase === 'guess') {
    body = me === i.imp ? `<div class="rounded-2xl bg-rose-500/15 p-4 ring-1 ring-rose-400/30"><div class="font-semibold text-rose-200">You were caught: you are the impostor!</div><div class="mt-1 text-sm text-white/70">Last chance: which film did everyone else have? Guess right for 150 points.</div></div><div class="grid grid-cols-2 gap-2 sm:grid-cols-4">${(i.guessOpts || []).map(o => `<button type="button" data-act="iguess" data-v="${esc(o.id)}" class="overflow-hidden rounded-xl bg-white/[0.05] text-left ring-1 ring-white/10 active:scale-[.98]">${gnPoster(o, 'aspect-[2/3] w-full')}<span class="block p-2 text-[13px] font-semibold leading-tight">${esc(o.title)}</span></button>`).join('')}</div>`
      : `<div class="rounded-2xl bg-white/[0.04] p-5 text-center"><div class="font-display text-2xl">${esc(gnName(i.imp))} was the impostor!</div><div class="mt-1 text-sm text-white/60">They get one guess at your film for bonus points…</div></div>`;
  } else {
    const r = i.result, n = {}; Object.values(i.votes).forEach(t => { n[t] = (n[t] || 0) + 1; });
    if (!r) body = '<div class="rounded-2xl bg-white/[0.04] p-5 text-center text-white/60">Round over.</div>';
    else {
      const head = r.left ? 'The impostor left' : r.caught ? 'Caught!' : r.tie ? 'It was a tie, so the impostor got away!' : 'The impostor got away!';
      const sub = r.left ? 'Nobody scores this round.' : r.caught ? (r.guessed ? 'and still guessed the film! +150' : r.guessMade ? 'and guessed the wrong film.' : 'and did not guess the film.') : '+300 for the impostor. Anyone who voted for them gets +50.';
      body = `<div class="rounded-2xl p-4 text-center ring-1 ${r.caught ? 'bg-green-500/15 ring-green-400/30' : 'bg-rose-500/15 ring-rose-400/30'}"><div class="text-xs uppercase tracking-[0.16em] text-white/55">${head}</div><div class="mt-1 font-display text-2xl">${esc(gnName(r.imp))} was the impostor</div><div class="mt-1 text-sm text-white/65">${sub}</div></div>
        <div class="grid gap-2 sm:grid-cols-2">${card(r.A, 'Everyone else had')}${card(r.B, 'The impostor had', 'bg-rose-500/10 ring-rose-400/25')}</div>
        <div class="rounded-2xl bg-white/[0.03] p-4 text-sm ring-1 ring-white/[0.06]"><div class="mb-2 text-white/55">Votes</div>${Object.entries(n).sort((a, b) => b[1] - a[1]).map(([u, c]) => `<div>${esc(gnName(u))}: ${c}</div>`).join('') || '<div class="text-white/40">Nobody voted.</div>'}</div>`;
    }
  }
  const showCard = i.phase === 'clue' || i.phase === 'vote' || (i.phase === 'guess' && me !== i.imp);
  return `<div class="mx-auto max-w-2xl space-y-3">${gnTimeBar()}${showCard ? card(myFilm, 'Your film', 'bg-gradient-to-br from-purple-500/15 to-blue-500/10 ring-white/10') : ''}${i.phase === 'clue' || i.phase === 'vote' ? '<div class="text-center text-xs text-white/40">One of you has a different film, and nobody knows who. Maybe it is you!</div>' : ''}${body}</div>`;
}
function giSubmitClue() { const el = document.getElementById('gnClueInput'); const t = el ? el.value.trim() : ''; if (!t) return; el.value = ''; gnDo('clue', { text: t }); }

// ---------- chat
function gnRenderChatInput() {
  const el = document.getElementById('gnChatInput'); if (!el) return;
  const st = GN.st, d = st && st.phase === 'play' && st.game === 'draw' ? st.d : null, me = gnMeId();
  const drawing = d && d.phase === 'draw' && d.drawer === me;
  el.disabled = !!drawing;
  const box = document.getElementById('gnChatBox'); if (box) { box.classList.toggle('h-[30vh]', !drawing); box.classList.toggle('h-[18vh]', !!drawing); }
  el.placeholder = drawing ? 'You are drawing: no typing the answer!' : d && d.phase === 'draw' && d.guessed[me] == null ? 'Type your guess here…' : 'Chat with the room';
}
function gnSubmitChat(e) {
  e.preventDefault();
  const el = document.getElementById('gnChatInput'); const t = el.value.trim().slice(0, 80); if (!t || !GN.ch) return;
  const now = Date.now(); if (GN.lastChat && now - GN.lastChat < 400) return; GN.lastChat = now;
  el.value = '';
  const st = GN.st;
  if (st && st.phase === 'play' && st.game === 'draw') gnSend({ t: 'guess', text: t });   // the host checks guesses and shows the wrong ones
  else gnSend({ t: 'chat', text: t });
}
function gnFeedAdd(m) { if (m.k === 'ok') gnSound('correct'); GN.feed.push(m); if (GN.feed.length > 150) GN.feed.shift(); const el = document.getElementById('gnFeed'); if (!el) return; el.insertAdjacentHTML('beforeend', gnFeedLine(m)); el.scrollTop = el.scrollHeight; }
function gnFeedRender() { const el = document.getElementById('gnFeed'); if (!el) return; el.innerHTML = GN.feed.map(gnFeedLine).join(''); el.scrollTop = el.scrollHeight; }
function gnFeedLine(m) {
  if (m.k === 'sys') return `<div class="text-[13px] italic text-white/45">${esc(m.text)}</div>`;
  if (m.k === 'ok') return `<div class="rounded-md bg-green-500/15 px-2 py-1 text-[13px] font-medium text-green-300">${esc(m.text)}</div>`;
  if (m.k === 'close') return `<div class="rounded-md bg-amber-400/15 px-2 py-1 text-[13px] text-amber-200">${esc(m.text)}</div>`;
  return `<div class="${m.k === 'gchat' ? 'text-green-200/80' : ''}"><b style="color:${gnColorOf(m.u)}">${esc(gnName(m.u))}:</b> <span class="text-white/85">${esc(m.text)}</span></div>`;
}
function gnCopy() { try { navigator.clipboard.writeText(gnLink()); showToast('Invite link copied'); } catch (e) { prompt('Copy this link', gnLink()); } }
function gnWhatsApp() { window.open('https://wa.me/?text=' + encodeURIComponent(`Join my WatchVibe game night! Room ${GN.code}: ${gnLink()}`), '_blank', 'noopener'); }

// a ?game=CODE link opens the room
(function () {
  const code = new URLSearchParams(location.search).get('game'); if (!code) return;
  let tries = 0; const iv = setInterval(() => { if (window.supabaseClient && typeof mediaDatabase !== 'undefined' && mediaDatabase.length) { clearInterval(iv); openGames(code); } else if (++tries > 40) clearInterval(iv); }, 300);
})();
