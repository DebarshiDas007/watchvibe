// Fixes the built-in catalogue inside index.html: real runtimes (many titles showed a made-up "2h 10m") and real
// directors / creators where a placeholder was stored. Data comes from TMDB. Run: node scripts/fix_runtimes.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const HTML = path.join(ROOT, 'web_live_build', 'index.html');
const src = fs.readFileSync(HTML, 'utf8');
const KEY = (src.match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const START = 'let mediaDatabase = ';
const a = src.indexOf(START), b = src.indexOf('];', a);
const db = JSON.parse(src.slice(a + START.length, b + 1));
const API = 'https://api.themoviedb.org/3';

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.status === 429) { await new Promise(r => setTimeout(r, 1000 * (i + 1))); continue; } if (!r.ok) return null; return await r.json(); }
    catch (e) { await new Promise(r => setTimeout(r, 500 * (i + 1))); }
  }
  return null;
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }
const fmt = rt => `${Math.floor(rt / 60)}h ${String(rt % 60).padStart(2, '0')}m`.replace(/^0h /, '').replace(' 0', ' ');
const PLACEHOLDER = /TMDB Featured|Creator \/ Showrunner|^Director$|^Showrunner$/;

const todo = db.filter(m => m.tmdbId && (m.type !== 'Series' ? (m.duration === '2h 10m' || PLACEHOLDER.test(m.director || '')) : PLACEHOLDER.test(m.director || '')));
console.log('titles to check:', todo.length, 'of', db.length);
let fixedRt = 0, fixedDir = 0, done = 0;
await pool(todo, 12, async m => {
  const tv = m.type === 'Series';
  const d = await get(`${API}/${tv ? 'tv' : 'movie'}/${m.tmdbId}?api_key=${KEY}&append_to_response=credits`);
  done++; if (done % 100 === 0) process.stdout.write(`\r${done}/${todo.length}`);
  if (!d) return;
  if (!tv && d.runtime > 0) { const f = fmt(d.runtime); if (f !== m.duration) { m.duration = f; fixedRt++; } }
  if (PLACEHOLDER.test(m.director || '')) {
    const who = tv ? (d.created_by || []).map(c => c.name).filter(Boolean).slice(0, 2).join(' & ') : ((d.credits && d.credits.crew) || []).find(c => c.job === 'Director')?.name;
    if (who) { m.director = who; fixedDir++; }
  }
});
console.log(`\nruntimes fixed: ${fixedRt}, directors fixed: ${fixedDir}`);
fs.writeFileSync(HTML, src.slice(0, a + START.length) + JSON.stringify(db) + src.slice(b + 1));
console.log('index.html updated');
