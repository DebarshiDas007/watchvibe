/*
 * WatchVibe content sweep: paste into the browser console on the running site (live or http://localhost:8080).
 * Checks every title in the catalogue and every home/filter view for render errors and bad text.
 * Network checks (images, trailers) are separate because they take a few minutes: see the bottom of this file.
 */
(async () => {
  const R = { total: mediaDatabase.length, renderErrors: [], badText: [], fieldIssues: {}, dupIds: [], viewErrors: [], views: 0 };
  const bad = /undefined|NaN|\[object|null/;
  const ids = new Set();
  const realStart = window.startTrailerPreview; window.startTrailerPreview = async () => {}; // no iframes during the sweep
  const holder = document.getElementById('modalContent'); const prev = holder.innerHTML;
  for (const m of mediaDatabase) {
    if (ids.has(m.id)) R.dupIds.push(m.id); ids.add(m.id);
    for (const [k, ok] of Object.entries({ title: !!m.title, poster: !!m.poster, backdrop: !!m.backdrop, year: !!m.year, rating: m.rating != null && !isNaN(m.rating), genres: Array.isArray(m.genres), vibe: !!VIBES[m.dominantVibe], synopsis: !!m.synopsis })) {
      if (!ok) (R.fieldIssues[k] = R.fieldIssues[k] || []).push(m.id);
    }
    try {
      const card = posterCard(m);
      delete holder.dataset.itemId; renderMovieDetailsModal(m);
      if (bad.test(holder.innerText) || card.includes('undefined')) R.badText.push(m.id);
    } catch (e) { R.renderErrors.push([m.id, String(e).slice(0, 80)]); }
  }
  window.startTrailerPreview = realStart; holder.innerHTML = prev; delete holder.dataset.itemId;

  const langs = ['', ...new Set(mediaDatabase.map(m => m.language))];
  for (const c of ['all', 'Movie', 'Series', 'Stand-Up']) for (const l of langs) for (const v of ['all', ...Object.keys(VIBES)]) {
    selectedTopCategory = c; selectedTopLanguage = l; selectedTopVibe = v; window.homeRow = null; window.currentFeedLimit = 36;
    try { if (/undefined|NaN|\[object/.test(renderDiscover())) R.viewErrors.push([c, l, v, 'bad text']); R.views++; } catch (e) { R.viewErrors.push([c, l, v, String(e).slice(0, 60)]); }
  }
  for (const r of [null, 'fresh', 'desi', 'series', 'standup', 'all']) { window.homeRow = r; try { renderDiscover(); R.views++; } catch (e) { R.viewErrors.push(['row', r, String(e).slice(0, 60)]); } }
  selectedTopCategory = 'all'; selectedTopLanguage = ''; selectedTopVibe = 'all'; window.homeRow = null;
  for (const s of [renderExplore, renderCommunity, renderWatchlist, renderProfile]) { try { s(); R.views++; } catch (e) { R.viewErrors.push([s.name, String(e).slice(0, 60)]); } }

  const summary = { titles: R.total, views: R.views, renderErrors: R.renderErrors.length, badText: R.badText.length, dupIds: R.dupIds.length, viewErrors: R.viewErrors.length, fieldIssues: Object.fromEntries(Object.entries(R.fieldIssues).map(([k, v]) => [k, v.length])) };
  console.log('WatchVibe sweep', summary, R);
  window.__sweep = R;
  return summary;
})();

/* Network checks (run separately; each takes a few minutes):
 *  - images: load every m.poster / m.backdrop with new Image() at ~24 parallel and count failures
 *  - trailers: await resolveTrailerKeys(m) for every title at ~8 parallel and count empty results
 *  - playback: await openDetails(id), then poll document.getElementById('previewSlot').style.opacity === '1'
 */
