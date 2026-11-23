// Shared request counter for the /api functions. It asks the database (atomic, shared by every Cloudflare location) whether this visitor
// is still within the limit. The visitor's IP is never stored: only a salted hash of it, with the salt in the RATE_SECRET secret.
// If the counter is unreachable the request is allowed (a hiccup must never take the site down).

const SUPABASE = 'https://lbtuikgpgcgrizijfiyl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxidHVpa2dwZ2Nncml6aWpmaXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NjQxMzgsImV4cCI6MjExMDM0MDEzOH0.y7PrOnBUjIBnT6N2vnOV9qkGgcKX1F_epMqBMoPKejU';   // the public key every visitor's browser already has

async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

// true = go ahead, false = this visitor has used up their allowance for the minute
export async function allow(context, scope, limit) {
  const secret = String((context.env && context.env.RATE_SECRET) || '').trim();   // a stray newline from how the secret was typed must not break the match
  if (!secret) return true;
  try {
    const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = scope + ':' + (await sha(ip + '|' + secret));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(SUPABASE + '/rest/v1/rpc/api_rate_hit', {
      method: 'POST', signal: ctl.signal,
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secret, p_key: key, p_bucket: Math.floor(Date.now() / 60000), p_limit: limit })
    });
    clearTimeout(timer);
    if (!r.ok) return true;
    return (await r.json()) !== false;
  } catch (e) { return true; }
}

export function tooMany() {
  return new Response(JSON.stringify({ error: 'too many requests', retry: 60 }), {
    status: 429,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '60', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}