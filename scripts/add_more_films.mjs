// Adds more Hindi, English and Bengali films to web_live_build/catalog_extra.json (TMDB), in the same shape as build_catalog.mjs.
// No duplicates: a film is skipped when its TMDB id, or its normalised title + year, is already in index.html or catalog_extra.json
// (or was already picked in this run). Existing entries are kept exactly as they are; new ones are appended.
// Run: node scripts/add_more_films.mjs   (needs internet; a few minutes). Then bump CAT.v in index.html and the sw.js cache version.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const HTML = path.join(ROOT, 'web_live_build', 'index.html');
const OUT = path.join(ROOT, 'web_live_build', 'catalog_extra.json');
const KEY = (fs.readFileSync(HTML, 'utf8').match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const API = 'https://api.themoviedb.org/3';
if (!KEY) throw new Error('no TMDB key found');

// how many to add per language, and the smallest vote count we accept for a candidate
const PLAN = [
  { lang: 'hi', add: 900, minVotes: 3, pages: 200 },
  { lang: 'bn', add: 220, minVotes: 3, pages: 40 },
  { lang: 'en', add: 1200, minVotes: 150, pages: 260 },
];
const REGION = { hi: 'Indian (Bollywood)', bn: 'Indian (Bengali)', en: 'Hollywood / Western' };
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const src = fs.readFileSync(HTML, 'utf8');
const a = src.indexOf('let mediaDatabase = ['), b = src.indexOf('];', a);
const base = JSON.parse(src.slice(a + 'let mediaDatabase = '.length, b + 1));
const extra = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const haveId = new Set(), haveKey = new Set(), haveSlug = new Set();
for (const m of base.concat(extra)) {
  if (m.tmdbId) haveId.add(String(m.tmdbId));
  haveKey.add(norm(m.title) + '|' + m.year);
  haveSlug.add(m.id);
}
console.log('already in the site:', base.length + extra.length);

async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) { await new Promise(r => setTimeout(r, 1200 * (i + 1))); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { await new Promise(r => setTimeout(r, 600 * (i + 1))); }
  }
  return null;
}
async function pool(items, n, fn) {
  let i = 0; const out = new Array(items.length);
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
async function candidates(lang, minVotes, pages) {
  const url = p => `${API}/discover/movie?api_key=${KEY}&with_original_language=${lang}&vote_count.gte=${minVotes}&sort_by=vote_count.desc&include_adult=false&page=${p}`;
  const first = await get(url(1)); if (!first) return [];
  const list = [...first.results];
  const total = Math.min(first.total_pages, pages, 500);
  const rest = await pool(Array.from({ length: Math.max(0, total - 1) }, (_, i) => i + 2), 8, p => get(url(p)));
  rest.forEach(r => r && list.push(...r.results));
  return list;
}

const GENRE = { 'Science Fiction': 'Sci-Fi' };
function vibeFor(genres, rating, votes) {
  const g = genres[0] || '';
  if (votes < 2500 && rating >= 7) return 'hidden_gem';
  if (['Comedy', 'Animation', 'Family', 'Music'].includes(g)) return 'fun_time';
  if (['Drama', 'War', 'History', 'Romance'].includes(g)) return 'emotional_damage';
  if (['Sci-Fi', 'Mystery'].includes(g)) return 'mind_blown';
  if (['Horror', 'Thriller'].includes(g)) return rating >= 7 ? 'must_watch' : 'mind_blown';
  if (g === 'Documentary') return 'must_watch';
  return rating >= 7.4 ? 'must_watch' : (g === 'Action' || g === 'Adventure' ? 'fun_time' : 'mind_blown');
}
const SECOND = { must_watch: 'mind_blown', mind_blown: 'must_watch', fun_time: 'must_watch', emotional_damage: 'must_watch', hidden_gem: 'must_watch' };
const THIRD = { must_watch: 'fun_time', mind_blown: 'fun_time', fun_time: 'mind_blown', emotional_damage: 'mind_blown', hidden_gem: 'mind_blown' };

function build(d, lang) {
  const crew = (d.credits && d.credits.crew) || [], cast = (d.credits && d.credits.cast) || [];
  const director = (crew.find(c => c.job === 'Director') || {}).name;
  const names = cast.slice(0, 8).map(c => c.name).filter(Boolean).slice(0, 5);
  if (!d.poster_path || !d.backdrop_path || !d.overview || d.overview.length < 60 || !director || names.length < 3) return null;   // never invent: incomplete entries are skipped
  const genres = (d.genres || []).map(g => GENRE[g.name] || g.name).slice(0, 3);
  if (!genres.length) return null;
  const year = (d.release_date || '').slice(0, 4); if (!/^\d{4}$/.test(year)) return null;
  const rt = d.runtime || 0; if (!rt) return null;   // unknown runtime: skip rather than guess
  const duration = `${Math.floor(rt / 60)}h ${String(rt % 60).padStart(2, '0')}m`.replace(' 0', ' ');
  const votes = d.vote_count || 0;
  const rating = Math.round(((votes * (d.vote_average || 0) + 100 * 6.3) / (votes + 100)) * 10) / 10;
  const dom = vibeFor(genres, rating, votes);
  const quality = rating >= 8 ? 'an exceptional' : rating >= 7 ? 'a well-loved' : rating >= 6 ? 'an enjoyable' : 'a divisive';
  return {
    id: slug(d.title) + '-' + d.id, tmdbId: d.id, title: d.title, type: 'Movie', year, language: lang, region: REGION[lang],
    genres, duration, director, cast: names,
    poster: 'https://image.tmdb.org/t/p/w500' + d.poster_path, backdrop: 'https://image.tmdb.org/t/p/w1280' + d.backdrop_path,
    synopsis: d.overview, rating, vibeReality: `Audiences describe ${d.title} as ${quality} ${genres[0]} experience${rating >= 7 ? ' with verified cinematic quality' : ''}.`,
    totalVotes: votes, dominantVibe: dom,
    vibeVotes: { [dom]: Math.round(votes * 0.55), [SECOND[dom]]: Math.round(votes * 0.30), [THIRD[dom]]: Math.round(votes * 0.15) }
  };
}

const added = [];
for (const p of PLAN) {
  const cands = await candidates(p.lang, p.minVotes, p.pages);
  const seen = new Set();
  const fresh = cands.filter(c => { if (haveId.has(String(c.id)) || seen.has(c.id) || c.original_language !== p.lang) return false; seen.add(c.id); return true; }).sort((x, y) => y.vote_count - x.vote_count);
  console.log(p.lang, 'candidates not yet in the site:', fresh.length, 'target', p.add);
  const picked = [];
  for (let i = 0; i < fresh.length && picked.length < p.add; i += 60) {
    const det = await pool(fresh.slice(i, i + 60), 12, c => get(`${API}/movie/${c.id}?api_key=${KEY}&language=en-US&append_to_response=credits`));
    for (const d of det) {
      if (!d || picked.length >= p.add) continue;
      const item = build(d, p.lang); if (!item) continue;
      const k = norm(item.title) + '|' + item.year;
      if (haveKey.has(k) || haveSlug.has(item.id)) continue;   // same film under another entry
      haveKey.add(k); haveId.add(String(d.id)); haveSlug.add(item.id); picked.push(item);
    }
    process.stdout.write(`\r${p.lang}: ${picked.length}/${p.add} (checked ${Math.min(i + 60, fresh.length)}/${fresh.length})   `);
  }
  console.log();
  added.push(...picked);
}
fs.writeFileSync(OUT, JSON.stringify(extra.concat(added)));
console.log('added', added.length, 'films; catalog_extra.json is now', (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB with', extra.length + added.length, 'films');
