// GET /api/upcoming?cc=IN
// Films and series that are NOT out yet (release date after today in the viewer's country), most anticipated first by TMDB popularity,
// then shown soonest first. Cached at the edge until the next India midnight, like /api/featured.
import { allow, tooMany } from '../_lib/limit.js';

const TMDB_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';   // the same public key the site already ships to browsers
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const SKIP_GENRES = new Set([10763, 10764, 10766, 10767]);          // news, reality, soap, talk
const GENRES = { 28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western', 10759: 'Action & Adventure', 10762: 'Kids', 10765: 'Sci-Fi & Fantasy', 10768: 'War & Politics' };

const json = (body, maxAge, sMaxAge) => new Response(JSON.stringify(body), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${sMaxAge}`, 'X-Content-Type-Options': 'nosniff' }
});
const T = async (path) => {
  const r = await fetch(`${TMDB}${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_KEY}`);
  if (!r.ok) throw new Error('tmdb ' + r.status);
  return r.json();
};
const istNow = () => new Date(Date.now() + 5.5 * 3600 * 1000);
const istDay = () => istNow().toISOString().slice(0, 10);
const secondsToIstMidnight = () => { const n = istNow(); return Math.max(600, Math.round(86400 - (n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds()))); };
const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const cc = (url.searchParams.get('cc') || 'IN').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return json({ error: 'bad country' }, 60, 60);
  const day = istDay();
  const cacheKey = new Request(`${url.origin}/api/upcoming?cc=${cc}&day=${day}&v=1`);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return hit; }
  if (!(await allow(context, 'upcoming', 12))) return tooMany();

  const from = addDays(day, 1), to = addDays(day, 270);
  const mv = `/discover/movie?region=${cc}&with_release_type=2|3&release_date.gte=${from}&release_date.lte=${to}&sort_by=popularity.desc&include_adult=false`;
  const tv = `/discover/tv?first_air_date.gte=${from}&first_air_date.lte=${to}&sort_by=popularity.desc&include_adult=false`;
  const [m1, m2, t1] = await Promise.all([
    T(mv + '&page=1').then(r => r.results).catch(() => []),
    T(mv + '&page=2').then(r => r.results).catch(() => []),
    T(tv + '&page=1').then(r => r.results).catch(() => [])
  ]);
  // a film can be returned for its release in this country while another market already has it: keep only those with the global date after today
  const rows = [...m1, ...m2].map(x => ({ x, type: 'Movie' })).concat(t1.map(x => ({ x, type: 'Series' })));
  const seen = new Set(), items = [];
  for (const { x, type } of rows) {
    const date = x.release_date || x.first_air_date || '';
    const title = x.title || x.name;
    if (!title || !x.poster_path || !date || date < from || x.adult) continue;
    if ((x.genre_ids || []).some(g => SKIP_GENRES.has(g))) continue;
    const id = `tmdb-${type === 'Series' ? 'tv' : 'm'}-${x.id}`;
    if (seen.has(id)) continue; seen.add(id);
    items.push({
      id, tmdb: x.id, type, title, year: date.slice(0, 4), date, overview: x.overview || '',
      poster: `${IMG}w500${x.poster_path}`, backdrop: x.backdrop_path ? `${IMG}w1280${x.backdrop_path}` : '',
      genres: (x.genre_ids || []).map(g => GENRES[g]).filter(Boolean).slice(0, 3), language: x.original_language || null,
      popularity: Math.round(x.popularity || 0)
    });
  }
  items.sort((a, b) => b.popularity - a.popularity);
  const picks = items.slice(0, 48).sort((a, b) => a.date.localeCompare(b.date) || b.popularity - a.popularity);
  const body = { day, cc, generatedAt: new Date().toISOString(), picks };
  const res = picks.length ? json(body, 600, secondsToIstMidnight()) : json(body, 30, 30);
  if (cache && picks.length && context.waitUntil) context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
