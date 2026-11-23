// GET /api/links?tmdb=864692&type=movie|tv&cc=IN&title=Pathaan
// Returns the direct "watch now" page of a title on each streaming service for a country, so the site can send
// people to the title itself instead of a search page. Source: JustWatch's public GraphQL endpoint (the same
// data Google's "Where to watch" uses). Server-side because browsers cannot call it (CORS). Results are cached at the edge.

import { allow, tooMany } from '../_lib/limit.js';

const JW = 'https://apis.justwatch.com/graphql';
const TTL_OK = 6 * 3600;   // 6 hours
const TTL_MISS = 600;      // 10 minutes for "not found" / upstream errors

function json(body, ttl) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=' + ttl, 'X-Content-Type-Options': 'nosniff' }
  });
}

function buildQuery(type) {
  const frag = 'content(country:$c,language:"en"){title originalReleaseYear externalIds{tmdbId}} offers(country:$c,platform:WEB){monetizationType standardWebURL package{clearName}}';
  return 'query($q:String!,$c:Country!){popularTitles(country:$c,first:10,filter:{searchQuery:$q,objectTypes:[' + (type === 'tv' ? 'SHOW' : 'MOVIE') + ']}){edges{node{id ... on Movie{' + frag + '} ... on Show{' + frag + '}}}}}';
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const tmdb = url.searchParams.get('tmdb') || '';
  const type = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
  const cc = (url.searchParams.get('cc') || '').toUpperCase();
  const title = (url.searchParams.get('title') || '').trim().slice(0, 100);
  if (!/^\d{1,9}$/.test(tmdb) || !/^[A-Z]{2}$/.test(cc) || title.length < 1) return json({ found: false, error: 'bad request' }, 60);

  // normalise the cache key so every visitor shares one entry per title and country
  const cacheKey = new Request(url.origin + '/api/links?tmdb=' + tmdb + '&type=' + type + '&cc=' + cc);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return hit; }
  if (!(await allow(context, 'links', 40))) return tooMany();   // only lookups that would call JustWatch count

  let res;
  try {
    const r = await fetch(JW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; WatchVibe)' },
      body: JSON.stringify({ query: buildQuery(type), variables: { q: title, c: cc } })
    });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const data = await r.json();
    const edges = (data && data.data && data.data.popularTitles && data.data.popularTitles.edges) || [];
    const node = edges.map(e => e.node).find(n => n && n.content && n.content.externalIds && String(n.content.externalIds.tmdbId) === tmdb);
    if (!node) {
      res = json({ found: false }, TTL_MISS);
    } else {
      const seen = new Set();
      const offers = [];
      for (const o of node.offers || []) {
        const u = String(o.standardWebURL || '');
        if (!/^https:\/\//i.test(u) || u.length > 600) continue;
        const key = (o.package && o.package.clearName) + '|' + o.monetizationType;
        if (seen.has(key)) continue;
        seen.add(key);
        offers.push({ n: String((o.package && o.package.clearName) || '').slice(0, 60), t: String(o.monetizationType || '').slice(0, 12), u });
      }
      res = json({ found: true, offers }, offers.length ? TTL_OK : TTL_MISS);
    }
  } catch (e) {
    return json({ found: false, error: 'lookup failed' }, 30);
  }
  if (cache && context.waitUntil) context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
