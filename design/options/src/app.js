/* Shared behaviour for the five WatchVibe design demos: routes, mood pages, film page, watchlist, search, a playable daily game.
   Each design supplies only its own look through WVApp.mount({ shell, home, card }). */
window.WVApp = (() => {
  const { films, moods, esc } = WV;
  const MG = { cry: /Drama|Music|War|History|Romance/, mind: /Sci-Fi|Thriller|Mystery|Crime/, laugh: /Comedy|Animation/, comfort: /Family|Animation|Comedy/, hype: /Action|Adventure|Crime/ };
  films.forEach(f => { f.moods = moods.map(m => m.id).filter(id => id === 'gem' ? (f.rating >= 8.2 && f.year < 2020) : MG[id].test(f.genre)); f.g1 = f.genre.split(' · ')[0]; });
  const PROV = ['Netflix', 'Prime Video', 'JioHotstar', 'Apple TV', 'YouTube Movies'];
  const prov = f => [PROV[f.id % 5], PROV[(f.id + 2) % 5]];
  let skin = null, genreF = 'All', sortF = 'top', timer = 0;
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('wvd_' + k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('wvd_' + k, JSON.stringify(v)); } catch (e) {} } };
  let wl = store.get('wl', []);
  const inWl = id => wl.includes(id);
  const sorts = { top: ['Top rated', (a, b) => b.rating - a.rating], new: ['Newest', (a, b) => b.year - a.year || b.rating - a.rating], az: ['A to Z', (a, b) => a.title.localeCompare(b.title)] };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const route = () => { const h = (location.hash || '#home').slice(1); const i = h.indexOf('-'); return i < 0 ? { name: h, arg: '' } : { name: h.slice(0, i), arg: h.slice(i + 1) }; };
  const chip = (label, href, on) => `<a class="chipb${on ? ' on' : ''}" href="${href}">${esc(label)}</a>`;
  const btnChip = (label, attr, on) => `<button type="button" class="chipb${on ? ' on' : ''}" ${attr}>${esc(label)}</button>`;
  const grid = list => `<div class="pg-grid">${list.map(f => skin.card(f, { link: true })).join('')}</div>`;
  const sortSel = () => `<label class="pg-sort"><span>Sort</span><select data-sort>${Object.entries(sorts).map(([k, v]) => `<option value="${k}"${sortF === k ? ' selected' : ''}>${v[0]}</option>`).join('')}</select></label>`;

  function pageMood(id) {
    const m = moods.find(x => x.id === id) || moods[0];
    const list = films.filter(f => f.moods.includes(m.id)).sort(sorts[sortF][1]);
    return `<section class="pg pg-mood"><a class="pg-back" href="#home">← All moods</a><h1>${esc(m.label)}</h1><p class="pg-sub">${esc(m.blurb)}</p>
      <div class="pg-chips">${moods.map(x => chip(x.label, '#mood-' + x.id, x.id === m.id)).join('')}</div>
      <div class="pg-tools"><span class="pg-count">${list.length} films, ranked by rating</span>${sortSel()}</div>${grid(list)}</section>`;
  }
  function pageFilms() {
    const gs = ['All', ...[...new Set(films.map(f => f.g1))].sort()];
    const list = films.filter(f => genreF === 'All' || f.genre.includes(genreF)).sort(sorts[sortF][1]);
    return `<section class="pg"><h1>All films</h1><p class="pg-sub">The whole demo catalogue. Pick a genre or sort it your way.</p>
      <div class="pg-chips">${gs.map(g => btnChip(g, `data-genre="${esc(g)}"`, g === genreF)).join('')}</div>
      <div class="pg-tools"><span class="pg-count">${list.length} films</span>${sortSel()}</div>${grid(list)}</section>`;
  }
  function pageFilm(id) {
    const f = films[+id] || films[0], more = films.filter(x => x !== f && x.moods.some(m => f.moods.includes(m))).sort((a, b) => b.rating - a.rating).slice(0, 8);
    const on = inWl(f.id);
    return `<section class="pg pg-film"><div class="fp-hero" style="--himg:url('${f.back()}')"><div class="fp-sh"></div><div class="fp-in"><a class="pg-back" href="#home" data-back>← Back</a>
      <div class="fp-row"><div class="fp-poster" style="background-image:url('${f.poster()}')"></div><div class="fp-info">
        <div class="fp-tags">${f.genre.split(' · ').map(g => `<span class="tagb">${esc(g)}</span>`).join('')}<span class="tagb">${f.year}</span></div>
        <h1>${esc(f.title)}</h1><div class="fp-meta"><b>★ ${f.rating}</b><span>${f.year}</span><span>${esc(f.genre)}</span></div><p>${esc(f.plot)}</p>
        <div class="fp-actions"><button type="button" class="btn solid" data-trailer="${f.id}">▶ Play trailer</button><button type="button" class="btn" data-add="${f.id}" aria-pressed="${on}">${on ? '✓ In watchlist' : '+ Watchlist'}</button></div></div></div></div></div>
      <div class="fp-body"><div class="fp-cols"><div><h3>Where to watch</h3><div class="pg-chips">${prov(f).map(p => `<span class="tagb big">${esc(p)}</span>`).join('')}</div><small class="pg-note">Sample availability for this demo.</small></div>
      <div><h3>It feels like</h3><div class="pg-chips">${f.moods.map(mid => chip(moods.find(m => m.id === mid).label, '#mood-' + mid, false)).join('')}</div></div></div>
      <h2 class="pg-h2">More like this</h2>${grid(more)}</div></section>`;
  }
  function pageWatchlist() {
    const list = wl.map(i => films[i]).filter(Boolean);
    if (!list.length) return `<section class="pg"><h1>Watchlist</h1><div class="pg-empty"><p>Nothing saved yet.</p><p class="pg-sub">Open any film and press the Watchlist button. It stays here for next time.</p><a class="btn solid" href="#films">Browse films</a></div></section>`;
    return `<section class="pg"><h1>Watchlist</h1><p class="pg-sub">${list.length} saved. Remove one with the cross.</p><div class="pg-grid">${list.map(f => `<div class="wl-item">${skin.card(f, { link: true })}<button type="button" class="wl-x" data-add="${f.id}" aria-label="Remove ${esc(f.title)}">✕</button></div>`).join('')}</div></section>`;
  }
  // ---- the daily game
  let G = null;
  const streak = () => store.get('streak', 7);
  function pageGames() {
    if (!G) return `<section class="pg pg-game"><div class="gm-card"><span class="tagb">Daily challenge no. 21</span><h1>Guess the film from one blurred frame</h1><p class="pg-sub">Five questions. The picture clears as the clock runs, so the sooner you answer the more it is worth.</p>
      <div class="gm-stats"><div><b>${streak()}</b><span>day streak</span></div><div><b>${store.get('best', 0)}</b><span>best score</span></div></div><button type="button" class="btn solid" data-start>Play today's round</button></div></section>`;
    if (G.done) return `<section class="pg pg-game"><div class="gm-card"><span class="tagb">Round complete</span><h1>${G.score} points</h1><p class="pg-sub">${G.right} of ${G.qs.length} right. ${G.right >= 4 ? 'You know your films.' : G.right >= 2 ? 'Solid. Try again tomorrow.' : 'The frames were hard. Play again.'}</p>
      <div class="gm-squares">${G.marks.join('')}</div><div class="gm-actions"><button type="button" class="btn solid" data-share>Copy my result</button><button type="button" class="btn" data-start>Play again</button></div></div></section>`;
    const q = G.qs[G.i];
    return `<section class="pg pg-game"><div class="gm-top"><span>Question ${G.i + 1} of ${G.qs.length}</span><span>Score <b>${G.score}</b></span></div>
      <div class="gm-bar"><i id="gmBar"></i></div>
      <div class="gm-pic" id="gmPic" style="background-image:url('${q.f.back()}');filter:blur(${G.picked == null ? 16 : 0}px)"></div>
      <div class="gm-q">${G.picked == null ? 'Which film is this?' : (G.picked === q.f ? 'Correct!' : 'It was ' + esc(q.f.title))}</div>
      <div class="gm-opts">${q.opts.map(o => `<button type="button" class="gm-o${G.picked != null ? (o === q.f ? ' ok' : o === G.picked ? ' bad' : ' dim') : ''}" data-pick="${o.id}" ${G.picked != null ? 'disabled' : ''}>${esc(o.title)}<small>${o.year}</small></button>`).join('')}</div>
      ${G.picked != null ? `<div class="gm-actions"><button type="button" class="btn solid" data-next>${G.i + 1 >= G.qs.length ? 'See my result' : 'Next question'}</button></div>` : ''}</section>`;
  }
  function gameStart() { G = { qs: shuffle(films).slice(0, 5).map(f => ({ f, opts: shuffle([f, ...shuffle(films.filter(x => x !== f)).slice(0, 3)]) })), i: 0, score: 0, right: 0, marks: [], picked: null, t: 20, done: false }; runClock(); render(); }
  function runClock() {
    clearInterval(timer); const t0 = Date.now();
    timer = setInterval(() => {
      if (!G || G.done || G.picked != null) { clearInterval(timer); return; }
      G.t = 20 - (Date.now() - t0) / 1000; const bar = document.getElementById('gmBar'), pic = document.getElementById('gmPic');
      if (bar) bar.style.width = Math.max(0, G.t / 20 * 100) + '%'; if (pic) pic.style.filter = `blur(${Math.max(2, 16 * G.t / 20)}px)`;
      if (G.t <= 0) { gamePick(null); }
    }, 100);
  }
  function gamePick(id) {
    if (!G || G.picked != null) return; const q = G.qs[G.i], o = id == null ? false : films[+id];
    G.picked = o || {}; clearInterval(timer);
    if (o === q.f) { const pts = Math.round(10 + Math.max(0, G.t) * 2); G.score += pts; G.right++; G.marks.push('🟩'); } else G.marks.push('🟥');
    render(false);
  }
  function gameNext() { if (G.i + 1 >= G.qs.length) { G.done = true; store.set('best', Math.max(store.get('best', 0), G.score)); store.set('streak', streak() + 1); } else { G.i++; G.picked = null; G.t = 20; runClock(); } render(); }
  // ---- overlays
  function toast(msg) { const t = document.createElement('div'); t.className = 'wv-toast'; t.textContent = msg; document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('in')); setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 2200); }
  function modal(html) { closeModal(); const m = document.createElement('div'); m.className = 'wv-modal'; m.innerHTML = `<div class="wv-modal-in" role="dialog" aria-modal="true">${html}<button type="button" class="wv-x" data-close aria-label="Close">✕</button></div>`; document.body.appendChild(m); document.body.style.overflow = 'hidden'; }
  function closeModal() { document.querySelectorAll('.wv-modal,.wv-search').forEach(n => n.remove()); document.body.style.overflow = ''; }
  function openSearch() {
    closeModal(); const s = document.createElement('div'); s.className = 'wv-search';
    s.innerHTML = `<div class="wv-search-in"><div class="wv-search-bar"><input id="wvq" type="search" placeholder="Search titles, genres, moods" autocomplete="off" aria-label="Search"><button type="button" class="wv-x2" data-close>Close</button></div><div id="wvres" class="wv-res"></div></div>`;
    document.body.appendChild(s); document.body.style.overflow = 'hidden';
    const inp = s.querySelector('#wvq'), res = s.querySelector('#wvres');
    const show = () => { const q = inp.value.trim().toLowerCase(); const list = q ? films.filter(f => (f.title + ' ' + f.genre + ' ' + f.year + ' ' + f.moods.map(m => moods.find(x => x.id === m).label).join(' ')).toLowerCase().includes(q)) : films.slice().sort((a, b) => b.rating - a.rating).slice(0, 8); res.innerHTML = (q ? `<p class="pg-count">${list.length} found</p>` : '<p class="pg-count">Top rated right now</p>') + (list.length ? `<div class="pg-grid sm">${list.map(f => skin.card(f, { link: true })).join('')}</div>` : '<p class="pg-sub">No match. Try a genre like "comedy" or a year.</p>'); };
    inp.addEventListener('input', show); show(); setTimeout(() => inp.focus(), 30);
  }
  // ---- render
  function render(scroll = true) {
    const r = route(); clearInterval(timer); if (r.name !== 'games') { G = G && G.done ? null : G; }
    let inner;
    if (r.name === 'mood') inner = pageMood(r.arg); else if (r.name === 'films') inner = pageFilms(); else if (r.name === 'film') inner = pageFilm(r.arg);
    else if (r.name === 'watchlist') inner = pageWatchlist(); else if (r.name === 'games') inner = pageGames(); else inner = skin.home();
    document.getElementById('app').innerHTML = skin.shell(inner, r.name);
    if (r.name === 'games' && G && !G.done && G.picked == null) runClock();
    if (scroll) window.scrollTo(0, 0);
    applyTheme(curTheme()); if (r.name === 'home') animateCounts(); if (window.WVHook) window.WVHook(r);
    document.title = (r.name === 'film' ? films[+r.arg].title + ' · ' : r.name === 'mood' ? (moods.find(m => m.id === r.arg) || {}).label + ' · ' : '') + skin.name;
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-back],[data-add],[data-search],[data-trailer],[data-close],[data-genre],[data-start],[data-pick],[data-next],[data-share]'); if (!t) { if (e.target.classList && e.target.classList.contains('wv-modal')) closeModal(); return; }
    if (t.hasAttribute('data-back')) { e.preventDefault(); if (history.length > 1) history.back(); else location.hash = 'home'; }
    else if (t.dataset.add != null) { e.preventDefault(); e.stopPropagation(); const id = +t.dataset.add; if (inWl(id)) { wl = wl.filter(x => x !== id); toast('Removed from your watchlist'); } else { wl = [...wl, id]; toast('Added to your watchlist'); } store.set('wl', wl); if (route().name === 'film' || route().name === 'watchlist') render(false); }
    else if (t.hasAttribute('data-search')) { e.preventDefault(); openSearch(); }
    else if (t.dataset.trailer != null) { const f = films[+t.dataset.trailer]; modal(`<div class="tr" style="background-image:url('${f.back()}')"><div class="tr-play">▶</div></div><div class="tr-cap"><b>${esc(f.title)}</b><span>In the real app the trailer plays here, from the film's best moment.</span></div>`); }
    else if (t.hasAttribute('data-close')) closeModal();
    else if (t.dataset.genre != null) { genreF = t.dataset.genre; render(false); }
    else if (t.hasAttribute('data-start')) gameStart();
    else if (t.dataset.pick != null) gamePick(t.dataset.pick);
    else if (t.hasAttribute('data-next')) gameNext();
    else if (t.hasAttribute('data-share')) { const txt = `WatchVibe Daily #21 · ${G.score} pts\n${G.marks.join('')}`; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Result copied'), () => toast('Copy not available here')); }
  });
  document.addEventListener('change', e => { if (e.target.matches('[data-sort]')) { sortF = e.target.value; render(false); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); openSearch(); } });
  window.addEventListener('hashchange', () => { closeModal(); render(); });

  // ================= extras used by the Swiss variations: dark mode, cursor preview, counters, tilt, keyboard rows =================
  const curTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const applyTheme = t => { document.documentElement.dataset.theme = t; document.querySelectorAll('[data-theme-label]').forEach(e => { e.textContent = t === 'dark' ? 'Light' : 'Dark'; }); document.querySelectorAll('[data-theme-toggle]').forEach(e => e.setAttribute('aria-pressed', t === 'dark')); };
  let prev = null;
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest ? e.target.closest('[data-prev]') : null;
    if (!el) { if (prev) prev.style.opacity = 0; }
    else { if (!prev) { prev = document.createElement('div'); prev.className = 'wv-prev'; document.body.appendChild(prev); } prev.style.backgroundImage = `url('${el.dataset.prev}')`; prev.style.opacity = 1; prev.style.transform = `translate(${Math.min(e.clientX + 28, innerWidth - 200)}px,${Math.max(10, e.clientY - 150)}px) rotate(-3deg)`; }
    const tl = e.target.closest ? e.target.closest('[data-tilt]') : null;
    if (tl) { const r = tl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; tl.style.transform = `perspective(700px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(0)`; }
  });
  document.addEventListener('pointerout', e => { const tl = e.target.closest ? e.target.closest('[data-tilt]') : null; if (tl && !tl.contains(e.relatedTarget)) tl.style.transform = ''; if (prev && e.target.closest && e.target.closest('[data-prev]') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-prev]'))) prev.style.opacity = 0; });
  function animateCounts() { document.querySelectorAll('[data-count]').forEach(el => { const to = +el.dataset.count, t0 = performance.now(), dec = el.dataset.dec ? +el.dataset.dec : 0; const step = n => { const k = Math.min(1, (n - t0) / 1000), v = to * (1 - Math.pow(1 - k, 3)); el.textContent = v.toFixed(dec); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }); }
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (!['j', 'k', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const rows = [...document.querySelectorAll('[data-kbrow]')]; if (!rows.length) return;
    const i = rows.indexOf(document.activeElement), d = (e.key === 'j' || e.key === 'ArrowDown') ? 1 : -1; e.preventDefault();
    const n = rows[Math.max(0, Math.min(rows.length - 1, i < 0 ? (d > 0 ? 0 : rows.length - 1) : i + d))]; n.focus(); n.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  document.addEventListener('click', e => { const b = e.target.closest ? e.target.closest('[data-theme-toggle]') : null; if (!b) return; const t = curTheme() === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('wvd_theme', t); } catch (x) {} applyTheme(t); });
  const WVX = { curTheme, applyTheme, animateCounts };
  return { WVX, mount(s) { skin = s; render(); }, wlCount: () => wl.length, inWl, chip, moods, films };
})();
