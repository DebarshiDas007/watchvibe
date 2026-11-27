// Adds more films in the smaller Indian languages (Telugu, Kannada, Marathi, Punjabi, Bengali, Malayalam) to
// web_live_build/catalog_extra.json, with a lower vote bar than the main build, and with no duplicates.
// Run after build_catalog.mjs:  node scripts/add_regional.mjs
import fs from 'node:fs';
import path from 'node:path';
import { readCore } from './_core.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const HTML = path.join(ROOT, 'web_live_build', 'index.html');
const OUT = path.join(ROOT, 'web_live_build', 'catalog_extra.json');
const src = fs.readFileSync(HTML, 'utf8');
const KEY = (src.match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const API = 'https://api.themoviedb.org/3';
const LANGS = { te: 'Indian (Tollywood)', kn: 'Indian (Sandalwood)', mr: 'Indian (Marathi)', pa: 'Indian (Punjabi)', bn: 'Indian (Bengali)', ml: 'Indian (Mollywood)', gu: 'Indian (Gujarati)', ur: 'Pakistani (Urdu)' };
let MIN_VOTES = 4, PER_LANG = { te: 450, kn: 250, mr: 200, pa: 150, bn: 250, ml: 150 };
// Optional: node scripts/add_regional.mjs <lang> <howMany> [minVotes]   e.g.  node scripts/add_regional.mjs bn 700 2   (one language only)
if (process.argv[2] && LANGS[process.argv[2]]) { PER_LANG = { [process.argv[2]]: Number(process.argv[3]) || 250 }; if (process.argv[4]) MIN_VOTES = Number(process.argv[4]); }
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const base = readCore(ROOT);   // the built-in catalogue (web_live_build/catalog_core.js)
const extra = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const haveId = new Set(), haveKey = new Set();
[...base, ...extra].forEach(m => { if (m.tmdbId && m.type === 'Movie') haveId.add(String(m.tmdbId)); haveKey.add(norm(m.title) + '|' + m.year); });
console.log('already have', base.length, 'built-in +', extra.length, 'extra');

async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.status === 429) { await new Promise(r => setTimeout(r, 1200 * (i + 1))); continue; } if (!r.ok) return null; return await r.json(); }
    catch (e) { await new Promise(r => setTimeout(r, 600 * (i + 1))); }
  }
  return null;
}
async function pool(items, n, fn) { let i = 0; const out = new Array(items.length); await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }
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
  if (!d.poster_path || !d.backdrop_path || !d.overview || d.overview.length < 60 || !director || names.length < 3) return null;
  const genres = (d.genres || []).map(g => GENRE[g.name] || g.name).slice(0, 3); if (!genres.length) return null;
  const year = (d.release_date || '').slice(0, 4); if (!/^\d{4}$/.test(year)) return null;
  const rt = d.runtime || 0; if (!rt) return null;
  const votes = d.vote_count || 0, rating = Math.round(((votes * (d.vote_average || 0) + 100 * 6.3) / (votes + 100)) * 10) / 10;
  const dom = vibeFor(genres, rating, votes), quality = rating >= 8 ? 'an exceptional' : rating >= 7 ? 'a well-loved' : rating >= 6 ? 'an enjoyable' : 'a divisive';
  const alts = (((d.alternative_titles || {}).titles) || []).map(t => t.title).concat([d.original_title]).filter(t => t && /[a-z]/i.test(t) && norm(t) !== norm(d.title) && t.length <= 60);
  const item = {
    id: slug(d.title) + '-' + d.id, tmdbId: d.id, title: d.title, type: 'Movie', year, language: lang, region: LANGS[lang],
    genres, duration: `${Math.floor(rt / 60)}h ${String(rt % 60).padStart(2, '0')}m`.replace(/^0h /, ''), director, cast: names,
    poster: 'https://image.tmdb.org/t/p/w500' + d.poster_path, backdrop: 'https://image.tmdb.org/t/p/w1280' + d.backdrop_path, synopsis: d.overview, rating,
    vibeReality: `Audiences describe ${d.title} as ${quality} ${genres[0]} experience${rating >= 7 ? ' with verified cinematic quality' : ''}.`,
    totalVotes: votes, dominantVibe: dom, vibeVotes: { [dom]: Math.round(votes * 0.55), [SECOND[dom]]: Math.round(votes * 0.30), [THIRD[dom]]: Math.round(votes * 0.15) }
  };
  if (alts.length) item.alt = [...new Set(alts)].slice(0, 3);
  return item;
}

const added = [];
for (const [lang, need] of Object.entries(PER_LANG)) {
  const list = [];
  const first = await get(`${API}/discover/movie?api_key=${KEY}&with_original_language=${lang}&vote_count.gte=${MIN_VOTES}&sort_by=vote_count.desc&include_adult=false&page=1`);
  if (!first) continue;
  list.push(...first.results);
  const pages = Math.min(first.total_pages, 60);
  const rest = await pool(Array.from({ length: pages - 1 }, (_, i) => i + 2), 8, p => get(`${API}/discover/movie?api_key=${KEY}&with_original_language=${lang}&vote_count.gte=${MIN_VOTES}&sort_by=vote_count.desc&include_adult=false&page=${p}`));
  rest.forEach(r => r && list.push(...r.results));
  const fresh = list.filter(c => !haveId.has(String(c.id))).sort((x, y) => y.vote_count - x.vote_count);
  let got = 0;
  for (let i = 0; i < fresh.length && got < need; i += 40) {
    const det = await pool(fresh.slice(i, i + 40), 12, c => get(`${API}/movie/${c.id}?api_key=${KEY}&language=en-US&append_to_response=credits,alternative_titles`));
    det.forEach(d => {
      if (!d || got >= need) return;
      const it = build(d, lang); if (!it) return;
      const k = norm(it.title) + '|' + it.year; if (haveKey.has(k)) return;
      haveKey.add(k); haveId.add(String(d.id)); added.push(it); got++;
    });
  }
  console.log(lang, 'candidates', fresh.length, 'added', got);
}
fs.writeFileSync(OUT, JSON.stringify(extra.concat(added)));
console.log('added', added.length, 'films; catalog_extra.json now', extra.length + added.length, 'films,', (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB');
