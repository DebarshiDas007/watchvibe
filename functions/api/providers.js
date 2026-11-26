// GET /api/providers?cc=IN&ids=m:123,t:456,...   (up to 40 titles)
// Where each title streams in ONE country, for a whole row at once. Replaces up to 40 separate browser calls to TMDB:
// one request from the visitor, the TMDB lookups run here (and are cached at the edge for 6 hours, shared by every visitor).
// Answer: { "m:123": { link, flatrate:[[id,name,logo]], ads, free, rent, buy }, ... }  (a title with no data in that country is { }).

import { allow, tooMany } from '../_lib/limit.js';

const TMDB_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';   // the same public key the site already ships to browsers

function json(body, ttl) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=' + ttl, 'X-Content-Type-Options': 'nosniff' }
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const cc = (url.searchParams.get('cc') || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return json({ error: 'bad request' }, 60);
  const ids = [...new Set((url.searchParams.get('ids') || '').split(',').filter(x => /^[mt]:\d{1,9}$/.test(x)))].slice(0, 40).sort();
  if (!ids.length) return json({}, 60);

  const cacheKey = new Request(url.origin + '/api/providers?cc=' + cc + '&ids=' + ids.join(','));
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return hit; }
  if (!(await allow(context, 'prov', 30))) return tooMany();   // 30 uncached batches a minute per visitor

  const pick = a => (a || []).map(x => [x.provider_id, x.provider_name, x.logo_path || null]);
  const out = {}; let failed = 0, i = 0;
  const worker = async () => {
    while (i < ids.length) {
      const k = ids[i++], n = k.slice(2);
      try {
        const r = await fetch('https://api.themoviedb.org/3/' + (k[0] === 't' ? 'tv' : 'movie') + '/' + n + '/watch/providers?api_key=' + TMDB_KEY, { cf: { cacheTtl: 21600, cacheEverything: true } });
        if (!r.ok) { failed++; continue; }
        const v = ((await r.json()).results || {})[cc];
        out[k] = v ? { link: v.link || null, flatrate: pick(v.flatrate), ads: pick(v.ads), free: pick(v.free), rent: pick(v.rent), buy: pick(v.buy) } : {};
      } catch (e) { failed++; }
    }
  };
  await Promise.all(Array.from({ length: 10 }, worker));

  const res = json(out, failed ? 60 : 3600);
  if (cache && !failed && context.waitUntil) context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
