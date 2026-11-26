// Adds every poster-bearing TMDB title of one original language (any vote count) to web_live_build/catalog_index.json, skipping ones already in it.
// Run: node scripts/add_index_lang.mjs bn      (the main index drops low-vote titles; regional languages lose most to that cut)
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'web_live_build', 'catalog_index.json');
const KEY = (fs.readFileSync(path.join(ROOT, 'web_live_build', 'index.html'), 'utf8').match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const lang = process.argv[2]; if (!/^[a-z]{2}$/.test(lang || '')) { console.log('usage: node scripts/add_index_lang.mjs bn'); process.exit(1); }
const J = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const have = new Set(J.a.map(r => r[7] + ':' + r[0]));
async function get(u, tries = 5) { for (let i = 0; i < tries; i++) { try { const r = await fetch(u); if (r.status === 429) { await new Promise(r => setTimeout(r, 1000 * (i + 1))); continue; } if (r.status === 422) return { results: [], total_pages: 0 }; if (!r.ok) { await new Promise(r => setTimeout(r, 500 * (i + 1))); continue; } return await r.json(); } catch (e) { await new Promise(r => setTimeout(r, 600 * (i + 1))); } } return null; }
let added = 0;
for (const kind of [0, 1]) {
  const type = kind ? 'tv' : 'movie';
  for (const sort of ['vote_count.desc', 'primary_release_date.desc', 'popularity.desc']) {
    const s = kind && sort.startsWith('primary') ? 'first_air_date.desc' : sort;
    const u = p => `https://api.themoviedb.org/3/discover/${type}?api_key=${KEY}&with_original_language=${lang}&include_adult=false&sort_by=${s}&page=${p}`;
    const f = await get(u(1)); if (!f) continue;
    for (let p = 1; p <= Math.min(f.total_pages || 1, 500); p++) {
      const j = p === 1 ? f : await get(u(p)); if (!j) continue;
      for (const r of j.results || []) {
        const title = kind ? r.name : r.title, date = (kind ? r.first_air_date : r.release_date) || '', k = kind + ':' + r.id;
        if (!r.poster_path || !title || r.adult || have.has(k)) continue;
        have.add(k); added++;
        J.a.push([r.id, title, Number(date.slice(0, 4)) || 0, r.poster_path.replace(/^\//, '').replace(/\.jpg$/, ''), Math.round((r.vote_average || 0) * 10), r.vote_count || 0, r.original_language || lang, kind]);
      }
    }
  }
  console.log(type, 'done, added so far', added);
}
J.a.sort((a, b) => b[5] - a[5]); J.t = new Date().toISOString().slice(0, 10);
fs.writeFileSync(OUT, JSON.stringify(J));
console.log('added', added, 'titles; index now', J.a.length, '(' + (fs.statSync(OUT).size / 1048576).toFixed(2) + ' MB)');
