// Runs for every /api/* request (see _routes.json: nothing else goes through here).
// The functions only answer GET and HEAD; anything else is refused. The per-visitor request limits live in
// functions/_lib/limit.js and are applied by each function just before it spends upstream quota (cache hits are free).

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Allow': 'GET, HEAD', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    });
  }
  return context.next();
}
