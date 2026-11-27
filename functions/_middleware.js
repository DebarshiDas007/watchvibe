// Runs for /api/* and for the page routes listed in _routes.json (static files such as images and JSON do not go through here).
// 1) The old address watchvibe-b92.pages.dev sends every page to the same path on https://watchvibe.app (301). /api stays reachable
//    on both hosts. Preview addresses (abc123.watchvibe-b92.pages.dev) are not touched.
// 2) The functions only answer GET and HEAD; anything else is refused. The per-visitor request limits live in
//    functions/_lib/limit.js and are applied by each function just before it spends upstream quota (cache hits are free).

const OLD_HOST = 'watchvibe-b92.pages.dev';
const NEW_ORIGIN = 'https://watchvibe.app';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const method = context.request.method;
  if (url.hostname === OLD_HOST && !url.pathname.startsWith('/api/') && (method === 'GET' || method === 'HEAD')) {
    return Response.redirect(NEW_ORIGIN + url.pathname + url.search, 301);
  }
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Allow': 'GET, HEAD', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    });
  }
  return context.next();
}