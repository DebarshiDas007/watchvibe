/*
 * WatchVibe card alignment audit. Paste into the browser console on the running site, at the width you want to check
 * (phone 375, tablet 768, desktop), then run:  await runCardAudit()
 *
 * For every group of sibling cards (poster cards, actor film cards, search results, watchlist cards...) it checks, row by row:
 *   issues  = the image boxes start at different heights or have different widths   (the bug fixed in commit 98f2e8b)
 *   ragged  = the lines under the image make the cards different heights            (title wraps to 1 vs 2 lines, extra badge lines)
 * It walks the main screens and modals. Takes about a minute. Do not resize the window while it runs.
 * Sanity check of the detector: remove the `self-start` class from the poster card buttons and re-run; it must report issues.
 */
window.auditCards = (label) => {
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 24 && r.height > 24 && el.offsetParent !== null; };
  const imgBox = card => card.querySelector('[class*="aspect-"], img');
  const cands = [...document.querySelectorAll('button, a, article, div.group, li')].filter(el => vis(el) && imgBox(el) && vis(imgBox(el)));
  const set = new Set(cands); const outer = cands.filter(el => { let p = el.parentElement; while (p) { if (set.has(p)) return false; p = p.parentElement; } return true; });
  const byParent = new Map(); outer.forEach(el => { const k = el.parentElement; (byParent.get(k) || byParent.set(k, []).get(k)).push(el); });
  const issues = [], ragged = [];
  byParent.forEach((cards, parent) => {
    if (cards.length < 2) return;
    const rows = []; let cur = []; let prev = -1;                       // a new row starts when the left offset stops increasing
    cards.forEach(c => { const l = c.offsetLeft; if (cur.length && l <= prev) { rows.push(cur); cur = []; } cur.push(c); prev = l; }); if (cur.length) rows.push(cur);
    rows.forEach(row => {
      if (row.length < 2) return;
      const boxes = row.map(c => imgBox(c).getBoundingClientRect());
      const dTop = Math.max(...boxes.map(b => b.top)) - Math.min(...boxes.map(b => b.top)), dW = Math.max(...boxes.map(b => b.width)) - Math.min(...boxes.map(b => b.width));
      const key = (parent.id ? '#' + parent.id : '') + '.' + String(parent.className).split(' ').slice(0, 4).join('.');
      if (dTop > 1 || dW > 1.5) issues.push({ screen: label, parent: key, dTop: Math.round(dTop), dW: Math.round(dW) });
      const tails = row.map(c => c.getBoundingClientRect().bottom - imgBox(c).getBoundingClientRect().bottom);
      const dTail = Math.max(...tails) - Math.min(...tails);
      if (dTail > 2) ragged.push({ screen: label, parent: key, dTail: Math.round(dTail), cards: row.length, sample: (row[0].innerText || '').replace(/\s+/g, ' ').slice(0, 24) });
    });
  });
  return { screen: label, groups: byParent.size, issues, ragged };
};
window.runCardAudit = async () => {
  const A = { width: innerWidth, issues: [], ragged: [] }; const w = ms => new Promise(r => setTimeout(r, ms));
  const scan = async (label, prep, scrollIt = true) => {
    try { await prep(); await w(1300); if (scrollIt) { for (let y = 0; y < 9; y++) { window.scrollTo(0, y * 650); await w(120); } window.scrollTo(0, 0); }
      const r = auditCards(label); r.issues.forEach(i => A.issues.push(i)); r.ragged.forEach(i => A.ragged.push(i)); } catch (e) { A.issues.push({ screen: label, error: String(e).slice(0, 80) }); }
  };
  window.startTrailerPreview = async () => {};
  await scan('home', async () => { setTopCategory('all'); switchTab('discover'); });
  for (const c of ['Movie', 'Series', 'Stand-Up']) await scan('feed ' + c, async () => { setTopCategory(c); });
  setTopCategory('all');
  for (const r of ['fresh', 'desi', 'series', 'standup', 'all']) await scan('home row ' + r, async () => { window.homeRow = r; switchTab('discover'); }); window.homeRow = null;
  await scan('search title', async () => { switchTab('explore'); await w(400); const i = document.getElementById('universalSearchInput'); i.value = 'the'; handleUniversalSearch('the'); await w(4500); });
  await scan('actor modal', async () => { openActorProfile('shah-rukh-khan'); await w(4500); }, false); closeActorProfile();
  await scan('details more like this', async () => { await openDetails('avengers-endgame-299534'); await w(5000); document.getElementById('detailScroll').scrollTop = 99999; }, false); closeDetails();
  // in-memory sample lists (not saved): the watchlist cards
  userWatchlistIds = ['Money Heist', 'Jawan', 'The Dark Knight', 'Avengers: Endgame', '3 Idiots', 'Interstellar'].map(n => mediaDatabase.find(m => m.title === n)).filter(Boolean).map(m => m.id);
  currentWatchlistSubTab = 'want'; await scan('watchlist want', async () => { switchTab('watchlist'); await w(4000); });
  switchTab('discover');
  return A;
};
// Usage: const r = await runCardAudit(); console.log(r.issues, r.ragged);   (reload the page afterwards to drop the sample lists)
