// GET /api/featured?cc=IN
// "What is hot right now" for the home banner. Returns a ranked pool of movies and series for a country; the page picks the
// day's five from it. Everyone in a country gets the same pool for the whole (India time) day because the answer is cached
// at the edge until the next midnight, so the selection refreshes daily and then stays put.
//
// Signals (all public, no scraping of other sites' pages):
//   TMDB trending today / this week    what people are opening right now
//   TMDB popularity                    TMDB's own blend of views, searches, watchlists
//   JustWatch popularity for the country   what people in that country are actually watching on streaming
//   recent releases on the big OTT services in that country (TMDB discover with watch providers)
//   Wikipedia most-viewed articles     what people are reading about (matched by exact title)
// Plus a freshness boost for new releases and a quality guard (no reality/talk shows, no low-rated titles).

import { allow, tooMany } from '../_lib/limit.js';

const TMDB_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';   // the same public key the site already ships to browsers
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const JW = 'https://apis.justwatch.com/graphql';
const POOL_SIZE = 14;

const IN_PROVIDERS = '8|119|2336|232|237|350|515';                 // Netflix, Prime Video, JioHotstar, ZEE5, SonyLIV, Apple TV, MX Player
const WORLD_PROVIDERS = '8|9|119|337|1899|15|386|531|350|384';       // Netflix, Prime, Disney+, Max, Hulu, Peacock, Paramount+, Apple TV
const SKIP_GENRES = new Set([10763, 10764, 10766, 10767]);          // news, reality, soap, talk
const GENRES = { 28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western', 10759: 'Action & Adventure', 10762: 'Kids', 10765: 'Sci-Fi & Fantasy', 10768: 'War & Politics' };
const COUNTRY = { IN: 'India', US: 'the US', GB: 'the UK', CA: 'Canada', AU: 'Australia', DE: 'Germany', FR: 'France', BR: 'Brazil', JP: 'Japan', KR: 'Korea' };

const json = (body, maxAge, sMaxAge) => new Response(JSON.stringify(body), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${sMaxAge}`, 'X-Content-Type-Options': 'nosniff' }
});

const T = async (path) => {
  const r = await fetch(`${TMDB}${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_KEY}`);
  if (!r.ok) throw new Error('tmdb ' + r.status);
  return r.json();
};
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const istNow = () => new Date(Date.now() + 5.5 * 3600 * 1000);
const istDay = () => istNow().toISOString().slice(0, 10);
const secondsToIstMidnight = () => { const n = istNow(); return Math.max(600, Math.round(86400 - (n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds()))); };

// ---------- signal collectors: each one fails soft, so a source being down never empties the banner ----------
async function trending(window) { try { return (await T(`/trending/all/${window}`)).results.filter(x => x.media_type === 'movie' || x.media_type === 'tv'); } catch (e) { return []; } }
async function recentOtt(cc) {
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const prov = cc === 'IN' ? IN_PROVIDERS : WORLD_PROVIDERS;
  const common = `watch_region=${cc}&with_watch_providers=${prov}&with_watch_monetization_types=flatrate&sort_by=popularity.desc`;
  const [m, t] = await Promise.all([
    T(`/discover/movie?${common}&primary_release_date.gte=${since}&vote_count.gte=20`).then(r => r.results.map(x => ({ ...x, media_type: 'movie' }))).catch(() => []),
    T(`/discover/tv?${common}&first_air_date.gte=${since}&vote_count.gte=10`).then(r => r.results.map(x => ({ ...x, media_type: 'tv' }))).catch(() => [])
  ]);
  return { movies: m.slice(0, 15), tv: t.slice(0, 15) };
}
async function justWatch(cc) {
  const q = 'query($c:Country!){popularTitles(country:$c,first:25,sortBy:POPULAR,filter:{objectTypes:[MOVIE,SHOW]}){edges{node{objectType ... on Movie{content(country:$c,language:"en"){title externalIds{tmdbId}}} ... on Show{content(country:$c,language:"en"){title externalIds{tmdbId}}}}}}}';
  try {
    const r = await fetch(JW, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; WatchVibe)' }, body: JSON.stringify({ query: q, variables: { c: cc } }) });
    const j = await r.json();
    return j.data.popularTitles.edges.map(e => ({ type: e.node.objectType === 'SHOW' ? 'tv' : 'movie', id: Number(e.node.content.externalIds.tmdbId) })).filter(x => x.id);
  } catch (e) { return []; }
}
async function wikipediaTop() {
  // most-read English Wikipedia articles of the last two published days; matched to titles below
  const out = new Map();
  for (const back of [1, 2]) {
    const d = new Date(Date.now() - back * 864e5);
    const p = n => String(n).padStart(2, '0');
    try {
      const r = await fetch(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`, { headers: { 'User-Agent': 'WatchVibe/1.0 (daily featured picks)' } });
      if (!r.ok) continue;
      const j = await r.json();
      for (const a of j.items[0].articles) {
        const raw = decodeURIComponent(a.article).replace(/_/g, ' ');
        if (/^(Main Page|Special:|Wikipedia:|Portal:|Category:|File:)/.test(raw)) continue;
        const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(raw);
        const base = m ? m[1] : raw, tag = m ? m[2] : '';
        // a bare title is accepted only when it has two or more words (avoids "The Body" the book, "Joker" the card, ...)
        const ok = m ? /film|tv|series|season|miniseries|anime|drama|show|\b20\d\d\b/i.test(tag) : base.trim().split(/\s+/).length >= 2;
        if (!ok) continue;
        const key = norm(base);
        out.set(key, Math.max(out.get(key) || 0, a.views));
      }
    } catch (e) { /* keep going with what we have */ }
  }
  return out;
}

// ---------- ranking ----------
const rankScore = (rank, n) => rank < 0 ? 0 : Math.max(0, 1 - rank / n);

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const cc = (url.searchParams.get('cc') || 'IN').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return json({ error: 'bad country' }, 60, 60);
  const day = istDay();
  const cacheKey = new Request(`${url.origin}/api/featured?cc=${cc}&day=${day}`);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return hit; }
  if (!(await allow(context, 'featured', 12))) return tooMany();   // building the pool calls five upstream services

  const [tDay, tWeek, ott, jw, wiki] = await Promise.all([trending('day'), trending('week'), recentOtt(cc), justWatch(cc), wikipediaTop()]);

  // pool of candidates keyed by type:id
  const pool = new Map();
  const key = (type, id) => `${type}:${id}`;
  const put = (x, type) => {
    const k = key(type, x.id);
    if (!pool.has(k)) pool.set(k, { type, id: x.id, d: x, day: -1, week: -1, ott: -1, jw: -1 });
    return pool.get(k);
  };
  tDay.slice(0, 20).forEach((x, i) => { put(x, x.media_type).day = i; });
  tWeek.slice(0, 20).forEach((x, i) => { put(x, x.media_type).week = i; });
  ott.movies.forEach((x, i) => { put(x, 'movie').ott = i; });
  ott.tv.forEach((x, i) => { put(x, 'tv').ott = i; });
  // JustWatch gives ids only: fetch details for the ones we have not seen yet (capped)
  const jwRank = new Map(jw.map((x, i) => [key(x.type, x.id), i]));
  const unknown = jw.filter(x => !pool.has(key(x.type, x.id))).slice(0, 10);
  const fetched = await Promise.all(unknown.map(x => T(`/${x.type}/${x.id}`).then(d => ({ ...d, genre_ids: (d.genres || []).map(g => g.id) })).catch(() => null)));
  fetched.forEach((d, i) => { if (d) put(d, unknown[i].type); });
  for (const [k, c] of pool) c.jw = jwRank.has(k) ? jwRank.get(k) : -1;

  const today = new Date().toISOString().slice(0, 10);
  const maxPop = Math.max(1, ...[...pool.values()].map(c => c.d.popularity || 0));
  const maxWiki = Math.max(1, ...wiki.values());
  const ageDays = d => d ? Math.round((Date.now() - Date.parse(d)) / 864e5) : 9999;

  const scored = [];
  for (const c of pool.values()) {
    const d = c.d, title = d.title || d.name, date = d.release_date || d.first_air_date || '';
    if (!title || !d.poster_path || !d.backdrop_path || !(d.overview || '').trim() || d.adult) continue;
    if ((d.genre_ids || []).some(g => SKIP_GENRES.has(g))) continue;
    const votes = d.vote_count || 0, vote = d.vote_average || 0;
    if (votes >= 100 && vote < 5.5) continue;                                   // well-known and poorly rated: not a "feature"
    const upcoming = date > today;
    const age = ageDays(date);
    const wv = wiki.get(norm(title)) || 0;
    const sWiki = wv ? 0.5 + 0.5 * (Math.log10(wv) / Math.log10(maxWiki)) : 0;
    const recency = upcoming ? (Date.parse(date) - Date.now() < 45 * 864e5 ? 0.5 : 0) : age <= 30 ? 1 : age <= 90 ? 0.6 : age <= 180 ? 0.3 : 0;
    let score = 0.28 * rankScore(c.day, 20) + 0.17 * rankScore(c.week, 20) + 0.12 * (Math.log10(1 + (d.popularity || 0)) / Math.log10(1 + maxPop))
      + 0.2 * rankScore(c.jw, 25) + 0.1 * sWiki + 0.13 * rankScore(c.ott, 15) + 0.12 * recency;
    if (votes >= 200 && vote >= 7.3) score += 0.06;
    scored.push({ c, d, title, date, upcoming, age, wv, score });
  }
  scored.sort((a, b) => b.score - a.score || (b.d.popularity || 0) - (a.d.popularity || 0));

  // where it streams in this country: it matters for the ranking (something you can press play on today beats a trailer-only hype)
  const shortlist = scored.slice(0, 20);
  const provs = await Promise.all(shortlist.map(s => T(`/${s.c.type}/${s.c.id}/watch/providers`).then(r => ((r.results || {})[cc] || {}).flatrate || []).catch(() => [])));
  const REGIONAL = cc === 'IN' ? new Set(['hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa']) : null;
  shortlist.forEach((s, i) => {
    s.platform = (provs[i][0] && provs[i][0].provider_name) || null;
    if (s.platform) s.score += 0.07;
    if (REGIONAL && REGIONAL.has(s.d.original_language)) s.score += 0.08;          // home-language cinema counts extra in India
  });
  shortlist.sort((a, b) => b.score - a.score || (b.d.popularity || 0) - (a.d.popularity || 0));
  const top = shortlist.slice(0, POOL_SIZE);  const where = COUNTRY[cc] || cc;
  const picks = top.map((s, i) => {
    const { c, d } = s;
    const platform = s.platform;
    const reasons = [];
    if (c.jw >= 0 && c.jw < 10) reasons.push(`Top ${c.jw + 1} on streaming in ${where}`);
    if (c.day >= 0 && c.day < 10) reasons.push(`Trending today (#${c.day + 1})`);
    else if (c.week >= 0 && c.week < 10) reasons.push(`Trending this week (#${c.week + 1})`);
    if (s.wv) reasons.push('Widely read about on Wikipedia');
    if (!s.upcoming && s.age <= 90 && platform) reasons.push(`New on ${platform}`);
    let badge = 'Hot right now';
    if (s.upcoming) badge = 'Coming soon';
    else if (!s.upcoming && s.age <= 90 && platform && c.ott >= 0) badge = `New on ${platform}`;
    else if (c.jw >= 0 && c.jw < 10) badge = `Popular in ${where}`;
    else if (c.day >= 0 && c.day < 10) badge = 'Trending now';
    else if (s.wv) badge = 'Talk of the web';
    return {
      id: `tmdb-${c.type === 'tv' ? 'tv' : 'm'}-${c.id}`, tmdb: c.id, type: c.type === 'tv' ? 'Series' : 'Movie',
      title: s.title, year: (s.date || '').slice(0, 4), date: s.date, overview: d.overview,
      backdrop: `${IMG}w1280${d.backdrop_path}`, poster: `${IMG}w500${d.poster_path}`,
      genres: (d.genre_ids || []).map(g => GENRES[g]).filter(Boolean).slice(0, 3),
      rating: d.vote_average ? Number(d.vote_average.toFixed(1)) : null, votes: d.vote_count || 0, language: d.original_language || null,
      upcoming: s.upcoming, platform, badge, reasons, score: Number(s.score.toFixed(4))
    };
  });

  const body = { day, cc, generatedAt: new Date().toISOString(), sources: { trendingDay: tDay.length, trendingWeek: tWeek.length, ottMovies: ott.movies.length, ottTv: ott.tv.length, justWatch: jw.length, wikipedia: wiki.size }, picks };
  const res = picks.length ? json(body, 600, secondsToIstMidnight()) : json(body, 30, 30);
  if (cache && picks.length && context.waitUntil) context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
