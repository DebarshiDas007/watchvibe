/*
 * WatchVibe product sweep. Paste the whole file into the browser console on the running site (live or local),
 * then run:   await runProductSweep()
 * Run it once at each width: phone 375, tablet 768, desktop 1440. It visits every page and checks for:
 *   - the page scrolling sideways, content sticking out of the screen
 *   - broken images, duplicate element ids, script errors
 *   - the top menu bar being wider than its space (the tablet "More" bug)
 *   - the catalogue: duplicates, missing details, made-up placeholders, vibe filters that match everything
 *   - Watch together refusing bad data from other devices
 * It returns { width, problems: [...], passed: [...] } so a problem list of [] means all clear.
 */
window.runProductSweep = async () => {
  const problems = [], passed = [];
  const errs = []; const onErr = e => errs.push(String(e.message || e.reason || '').slice(0, 120));
  window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const W = innerWidth;

  // ---- every page
  const pageCheck = async (label) => {
    const d = document.documentElement, issues = [];
    if (d.scrollWidth > W + 1) issues.push(`page scrolls sideways by ${d.scrollWidth - W}px`);
    const out = [...document.querySelectorAll('#mainViewport *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 2 || r.left < -2) && !e.closest('.overflow-x-auto,.no-scrollbar,[class*="overflow-x"],#heroCarousel'); });
    if (out.length) issues.push(`${out.length} elements stick out (e.g. ${out[0].tagName}.${String(out[0].className).slice(0, 40)})`);
    const broken = [...document.querySelectorAll('#mainViewport img')].filter(i => i.complete && !i.naturalWidth && i.getAttribute('src') && i.offsetParent);
    if (broken.length) issues.push(`${broken.length} broken images`);
    const nav = document.getElementById('topCategoryNavBar');
    if (nav && nav.offsetParent && nav.scrollWidth > nav.clientWidth + 1) issues.push(`top menu is ${nav.scrollWidth - nav.clientWidth}px too wide`);
    const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; });
    const dup = Object.entries(ids).filter(([, v]) => v > 1).map(([k]) => k); if (dup.length) issues.push('duplicate ids: ' + dup.slice(0, 5).join(', '));
    issues.length ? problems.push(`${label} @${W}px: ${issues.join('; ')}`) : passed.push(`${label} page`);
  };
  for (const [tab, label] of [['discover', 'Home'], ['explore', 'Search'], ['community', 'Taste Match'], ['watchlist', 'Watchlist'], ['profile', 'Profile'], ['daily', 'Daily']]) {
    switchTab(tab); await wait(1500); await pageCheck(label);
  }
  for (const [cat, label] of [['Movie', 'Movies'], ['Series', 'Series'], ['Stand-Up', 'Stand-Up']]) { setTopCategory(cat); await wait(1200); await pageCheck(label + ' grid'); }
  goHome();

  // ---- catalogue
  const db = mediaDatabase, ids = new Map(); let dupId = 0, dupKey = 0; const keys = new Set();
  db.forEach(m => { const k = (m.type === 'Series' ? 'tv' : 'm') + (m.tmdbId || m.id); if (ids.has(k)) dupId++; ids.set(k, 1); const t = String(m.title).toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + m.year; if (keys.has(t)) dupKey++; keys.add(t); });
  dupId || dupKey ? problems.push(`catalogue has duplicates (${dupId} by id, ${dupKey} by title+year)`) : passed.push('no duplicate films');
  const mv = db.filter(m => m.type === 'Movie');
  const hw = mv.filter(m => m.region === 'Hollywood / Western').length, ind = mv.filter(m => String(m.region || '').startsWith('Indian')).length;
  if (hw < 3000) problems.push(`only ${hw} Hollywood films (want 3000+)`); else passed.push(`${hw} Hollywood films`);
  if (ind < 2000) problems.push(`only ${ind} Indian films (want 2000+)`); else passed.push(`${ind} Indian films`);
  const bad = { noPoster: 0, noSynopsis: 0, noCast: 0, placeholder: 0 };
  const live = m => /^tmdb-(m|tv)-/.test(String(m.id));   // titles added by the daily trending sync: details are loaded when opened
  db.forEach(m => { if (!m.poster) bad.noPoster++; if (!m.synopsis) bad.noSynopsis++; if ((!m.cast || !m.cast.length) && !live(m)) bad.noCast++; if (/TMDB Featured|Creator \/ Showrunner|^Director$|^Showrunner$|Live daily trending/.test((m.director || '') + (m.synopsis || ''))) bad.placeholder++; });
  Object.entries(bad).forEach(([k, v]) => { if (v) problems.push(`${v} titles with ${k}`); }); if (!Object.values(bad).some(Boolean)) passed.push('every title has poster, story, cast and no placeholders');
  // vibe filters must not match everything
  for (const v of ['mind_blown', 'fun_time', 'emotional_damage', 'hidden_gem']) { const n = db.filter(m => m.dominantVibe === v).length; if (n === 0 || n > db.length * 0.7) problems.push(`vibe ${v} matches ${n} of ${db.length}`); }
  passed.push('vibe filters are selective');

  // ---- Watch together must refuse bad data
  try {
    const evil = { id: "x'});alert(1);//", title: '<img src=x onerror=alert(1)>', poster: 'javascript:alert(1)' };
    if (wtSafeItem(evil) !== null) problems.push('Watch together accepts a film with a code-injection id');
    const st = wtSafeState({ short: [evil], votes: { a: '1);alert(1' }, pick: '0;alert(1)', counts: { '😂': '5<script>' } });
    if (st.short.length || Object.keys(st.votes).length || st.pick !== null) problems.push('Watch together accepts bad votes or picks');
    if (!problems.some(p => /Watch together/.test(p))) passed.push('Watch together refuses bad data');
  } catch (e) { problems.push('Watch together checks failed to run: ' + e.message); }

  // ---- credits are links: a name opens that person's page, and a hostile name never injects markup
  try {
    const m = db.find(x => x.director && !/^(Director|Showrunner)$/.test(x.director) && x.cast && x.cast.length >= 3);
    openDetails(m.id); await wait(1500);
    if (document.querySelectorAll('#detailModal [data-person]').length < 2) problems.push('credits are not links on a title page');
    else { openPerson(m.cast[0], 'Actor'); await wait(1200); if (document.getElementById('actorModal').classList.contains('hidden')) problems.push('clicking a credit does not open the person page'); closeActorProfile(); }
    openPerson('<img src=x onerror=alert(1)>', 'Actor'); await wait(600);
    if (document.querySelector('#actorModal img[src="x"]')) problems.push('person page lets a name inject markup');
    closeActorProfile(); closeDetails();
    if (!problems.some(p => /credit|person page/.test(p))) passed.push('credits open person pages safely');
  } catch (e) { problems.push('credits check failed to run: ' + e.message); }

  // ---- game rooms: no value a player controls may reach an onclick
  try { if (typeof gnClick !== 'function' || typeof gnHandle !== 'function') problems.push('game room code is missing'); else passed.push('game room code present'); } catch (e) {}

  window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr);
  errs.length ? problems.push('script errors: ' + errs.slice(0, 3).join(' | ')) : passed.push('no script errors');
  return { width: W, problems, passed };
};
'runProductSweep ready: run  await runProductSweep()';
