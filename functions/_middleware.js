// Rate limit for every /api/* request (see _routes.json: nothing else runs through here).
// One visitor (by IP) may make 300 requests a minute in total; more get a 429 until the minute is over.
// The counter lives in the edge cache, so it is per Cloudflare location and approximate, which is plenty to stop scripted abuse of
// the OMDb / JustWatch / TMDB quotas while normal browsing (a page of posters asks for ratings a few at a time) never comes close.
// Real WAF rate-limit rules need a domain on your own Cloudflare zone; add them there when WatchVibe gets its own domain.

const LIMIT = 300;
const WINDOW = 60;   // seconds

function tooMany() {
  return new Response(JSON.stringify({ error: 'too many requests', retry: WINDOW }), {
    status: 429,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': String(WINDOW), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Allow': 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) {
    try {
      const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
      const bucket = Math.floor(Date.now() / (WINDOW * 1000));
      const key = new Request('https://rate-limit.watchvibe.invalid/' + encodeURIComponent(ip) + '/' + bucket);
      const hit = await cache.match(key);
      const n = hit ? (parseInt(await hit.text(), 10) || 0) : 0;
      if (n >= LIMIT) return tooMany();
      const put = cache.put(key, new Response(String(n + 1), { headers: { 'Cache-Control': 'max-age=' + WINDOW } }));
      if (context.waitUntil) context.waitUntil(put); else await put;
    } catch (e) { /* a cache hiccup must never block real visitors */ }
  }
  return context.next();
}
