// GET /api/imdb?tmdb=475557&type=movie|tv
// Returns the title's IMDb rating and vote count: TMDB supplies the IMDb id, OMDb (which mirrors IMDb) supplies the rating.
// Server-side so the OMDb key stays out of every visitor's requests and so results are cached at the edge, which means
// each title costs one OMDb request per week for ALL visitors together (the free key allows 1,000 a day).

const TMDB_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';   // the same public key the site already ships to browsers
// the OMDb key lives only in the OMDB_KEY secret of the Cloudflare Pages project (never in this file)
const TTL_OK = 7 * 24 * 3600;
const TTL_MISS = 6 * 3600;

function json(body, ttl) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=' + ttl, 'X-Content-Type-Options': 'nosniff' }
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const tmdb = url.searchParams.get('tmdb') || '';
  const type = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
  if (!/^\d{1,9}$/.test(tmdb)) return json({ r: null, error: 'bad request' }, 60);

  const cacheKey = new Request(url.origin + '/api/imdb?tmdb=' + tmdb + '&type=' + type);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return hit; }

  let res;
  try {
    const ex = await fetch(`https://api.themoviedb.org/3/${type}/${tmdb}/external_ids?api_key=${TMDB_KEY}`);
    if (!ex.ok) throw new Error('tmdb ' + ex.status);
    const imdbId = ((await ex.json()) || {}).imdb_id;
    if (!/^tt\d{5,10}$/.test(imdbId || '')) {
      res = json({ r: null }, TTL_MISS);
    } else {
      const key = context.env && context.env.OMDB_KEY;
      if (!key) return json({ r: null, error: 'not configured' }, 60);   // never cached: it starts working as soon as the secret exists
      const o = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${encodeURIComponent(key)}`);
      const d = await o.json();
      if (d && d.Response === 'False' && /limit/i.test(d.Error || '')) return json({ r: null, limit: true }, 60);   // daily quota hit: do not cache
      const r = parseFloat(d && d.imdbRating);
      const v = d && d.imdbVotes && d.imdbVotes !== 'N/A' ? String(d.imdbVotes) : null;
      res = isFinite(r) ? json({ r, v, id: imdbId }, TTL_OK) : json({ r: null, id: imdbId }, TTL_MISS);
    }
  } catch (e) {
    return json({ r: null, error: 'lookup failed' }, 30);
  }
  if (cache && context.waitUntil) context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
