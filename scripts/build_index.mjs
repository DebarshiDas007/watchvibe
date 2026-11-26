// Builds web_live_build/catalog_index.json: a compact search index of (nearly) every TMDB film and series that has a poster and a few real votes.
// The site loads it only when someone starts to search; a title opened from it is fetched live from TMDB (full details, cast, trailer).
// Format: { v, t: <build date>, a: [[id, title, year, posterPath (no leading slash or .jpg), rating x10, votes, language, kind (0 film, 1 series)], ...] }, most-voted first.
// Run: node scripts/build_index.mjs [minVotesMovie=25] [minVotesTv=10]   (needs internet; a few minutes)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'web_live_build', 'catalog_index.json');
const HTML = path.join(ROOT, 'web_live_build', 'index.html');
const KEY = (fs.readFileSync(HTML, 'utf8').match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const API = 'https://api.themoviedb.org/3';
const MINV = { movie: Number(process.argv[2]) || 25, tv: Number(process.argv[3]) || 10 };
const YEARS = []; for (let y = 1900; y <= new Date().getFullYear() + 1; y++) YEARS.push(y);

async function get(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) { await new Promise(r => setTimeout(r, 1000 * (i + 1))); continue; }
      if (r.status === 422) return { results: [], total_pages: 0 };   // past the last page TMDB allows
      if (!r.ok) { await new Promise(r => setTimeout(r, 500 * (i + 1))); continue; }
      return await r.json();
    } catch (e) { await new Promise(r => setTimeout(r, 600 * (i + 1))); }
  }
  return null;
}
async function pool(items, n, fn) {
  let i = 0; const out = new Array(items.length);
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

const rows = new Map();   // "m123" / "t456" -> row
let failed = 0;
function add(kind, r) {
  const title = kind ? r.name : r.title, date = (kind ? r.first_air_date : r.release_date) || '';
  if (!r.poster_path || !title || r.adult) return;
  const id = (kind ? 't' : 'm') + r.id; if (rows.has(id)) return;
  rows.set(id, [r.id, title, Number(date.slice(0, 4)) || 0, r.poster_path.replace(/^\//, '').replace(/\.jpg$/, ''), Math.round((r.vote_average || 0) * 10), r.vote_count || 0, r.original_language || '', kind]);
}

for (const kind of [0, 1]) {
  const type = kind ? 'tv' : 'movie', yp = kind ? 'first_air_date_year' : 'primary_release_year';
  await pool(YEARS, 10, async y => {
    const url = p => `${API}/discover/${type}?api_key=${KEY}&include_adult=false&vote_count.gte=${MINV[type]}&${yp}=${y}&sort_by=vote_count.desc&page=${p}`;
    const first = await get(url(1)); if (!first) { failed++; return; }
    (first.results || []).forEach(r => add(kind, r));
    const pages = Math.min(first.total_pages || 1, 500);
    for (let p = 2; p <= pages; p++) { const j = await get(url(p)); if (!j) { failed++; continue; } (j.results || []).forEach(r => add(kind, r)); }
  });
  console.log(type, 'done, total so far', rows.size);
}

const all = [...rows.values()].sort((a, b) => b[5] - a[5]);
fs.writeFileSync(OUT, JSON.stringify({ v: 1, t: new Date().toISOString().slice(0, 10), a: all }));
console.log('titles:', all.length, 'failed requests:', failed, 'size MB:', (fs.statSync(OUT).size / 1048576).toFixed(2));

