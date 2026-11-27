// Adds `alt` (other names a film is known by, in Latin letters) to every Indian film, in both the built-in catalogue
// (inside index.html) and catalog_extra.json. Search and the Draw game use it, so "Laapataa Ladies" finds "Lost Ladies".
// Run: node scripts/add_alt_titles.mjs
import fs from 'node:fs';
import path from 'node:path';
import { readCore, writeCore } from './_core.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const HTML = path.join(ROOT, 'web_live_build', 'index.html');
const OUT = path.join(ROOT, 'web_live_build', 'catalog_extra.json');
const src = fs.readFileSync(HTML, 'utf8');
const KEY = (src.match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const base = readCore(ROOT);   // the built-in catalogue (web_live_build/catalog_core.js)
const extra = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const API = 'https://api.themoviedb.org/3';
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.status === 429) { await new Promise(r => setTimeout(r, 1000 * (i + 1))); continue; } if (!r.ok) return null; return await r.json(); }
    catch (e) { await new Promise(r => setTimeout(r, 500 * (i + 1))); }
  }
  return null;
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }

const todo = base.concat(extra).filter(m => m.type === 'Movie' && m.tmdbId && String(m.region || '').startsWith('Indian') && !m.alt);
console.log('Indian films to look up:', todo.length);
let done = 0, withAlt = 0;
await pool(todo, 12, async m => {
  const d = await get(`${API}/movie/${m.tmdbId}/alternative_titles?api_key=${KEY}`);
  const r = await get(`${API}/movie/${m.tmdbId}?api_key=${KEY}`);
  done++; if (done % 100 === 0) process.stdout.write(`\r${done}/${todo.length}`);
  const names = ((d && d.titles) || []).map(t => t.title).concat([r && r.original_title]).filter(t => t && /[a-z]/i.test(t) && norm(t) !== norm(m.title) && t.length <= 60);
  const uniq = []; const seen = new Set([norm(m.title)]); names.forEach(t => { if (!seen.has(norm(t))) { seen.add(norm(t)); uniq.push(t); } });
  m.alt = uniq.slice(0, 3); if (m.alt.length) withAlt++; else m.alt = [];   // [] = looked up, nothing to add
});
console.log(`\nfilms with other names: ${withAlt} of ${todo.length}`);
extra.forEach(m => { if (Array.isArray(m.alt) && !m.alt.length) delete m.alt; });
base.forEach(m => { if (Array.isArray(m.alt) && !m.alt.length) delete m.alt; });
fs.writeFileSync(OUT, JSON.stringify(extra));
writeCore(ROOT, base);   // also raises catalog_core.js?v=N in index.html
console.log('written');
