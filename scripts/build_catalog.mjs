// Builds web_live_build/catalog_extra.json: extra Hollywood and Indian films from TMDB, in exactly the same shape as the
// films already inside index.html, with no duplicates (by TMDB id, and by normalised title + year).
// Run: node scripts/build_catalog.mjs   (needs internet; takes a few minutes)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const HTML = path.join(ROOT, 'web_live_build', 'index.html');
const OUT = path.join(ROOT, 'web_live_build', 'catalog_extra.json');
const KEY = (fs.readFileSync(HTML, 'utf8').match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const API = 'https://api.themoviedb.org/3';
const TARGET_HW = 3400, TARGET_IN = 2500;   // totals including the films already in the site

const REGION = { hi: 'Indian (Bollywood)', ta: 'Indian (Kollywood)', te: 'Indian (Tollywood)', ml: 'Indian (Mollywood)', kn: 'Indian (Sandalwood)', bn: 'Indian (Bengali)', mr: 'Indian (Marathi)', pa: 'Indian (Punjabi)', en: 'Hollywood / Western' };
const IN_LANGS = ['hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa'];
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// ---- what the site already has
const src = fs.readFileSync(HTML, 'utf8');
const a = src.indexOf('let mediaDatabase = ['), b = src.indexOf('];', a);
const existing = JSON.parse(src.slice(a + 'let mediaDatabase = '.length, b + 1));
const haveId = new Set(), haveKey = new Set();
let haveHw = 0, haveIn = 0;
for (const m of existing) {
  if (m.tmdbId) haveId.add(String(m.tmdbId));
  haveKey.add(norm(m.title) + '|' + m.year);
  if (m.type === 'Movie' && m.region === REGION.en) haveHw++;
  if (m.type === 'Movie' && String(m.region || '').startsWith('Indian')) haveIn++;
}
console.log('existing films:', existing.length, 'Hollywood', haveHw, 'Indian', haveIn);

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

// ---- candidates: most-voted first
async function candidates(lang, minVotes, pages) {
  const list = [];
  const first = await get(`${API}/discover/movie?api_key=${KEY}&with_original_language=${lang}&vote_count.gte=${minVotes}&sort_by=vote_count.desc&include_adult=false&page=1`);
  if (!first) return list;
  const total = Math.min(first.total_pages, pages);
  list.push(...first.results);
  const rest = await pool(Array.from({ length: total - 1 }, (_, i) => i + 2), 8, p => get(`${API}/discover/movie?api_key=${KEY}&with_original_language=${lang}&vote_count.gte=${minVotes}&sort_by=vote_count.desc&include_adult=false&page=${p}`));
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
  if (!d.poster_path || !d.backdrop_path || !d.overview || d.overview.length < 60 || !director || names.length < 3) return null;
  const genres = (d.genres || []).map(g => GENRE[g.name] || g.name).slice(0, 3);
  if (!genres.length) return null;
  const year = (d.release_date || '').slice(0, 4); if (!/^\d{4}$/.test(year)) return null;
  const rt = d.runtime || 0, duration = rt ? `${Math.floor(rt / 60)}h ${String(rt % 60).padStart(2, '0')}m`.replace(' 0', ' ') : '2h 0m';
  const votes = d.vote_count || 0;
  // films with few votes get a weighted rating (pulled toward the average), so a handful of fans cannot put an unknown film at the top
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

async function collect(label, lang, candList, need, hwOnlyEnglish) {
  const picked = [];
  const seenKey = new Set(), seenId = new Set();
  const fresh = candList.filter(c => {
    if (haveId.has(String(c.id)) || seenId.has(c.id)) return false;
    seenId.add(c.id);
    return true;
  }).sort((x, y) => y.vote_count - x.vote_count);
  console.log(label, 'candidates not already present:', fresh.length, 'need', need);
  const BATCH = 60;
  for (let i = 0; i < fresh.length && picked.length < need; i += BATCH) {
    const slice = fresh.slice(i, i + BATCH);
    const det = await pool(slice, 12, c => get(`${API}/movie/${c.id}?api_key=${KEY}&language=en-US&append_to_response=credits`));
    det.forEach(d => {
      if (!d || picked.length >= need) return;
      const lg = d.original_language;
      const item = build(d, lang === 'IN' ? lg : lang);
      if (!item || !(item.region)) return;
      const k = norm(item.title) + '|' + item.year;
      if (haveKey.has(k) || seenKey.has(k)) return;   // same film under another TMDB entry
      seenKey.add(k); haveKey.add(k); haveId.add(String(d.id)); picked.push(item);
    });
    process.stdout.write(`\r${label}: ${picked.length}/${need}  (checked ${Math.min(i + BATCH, fresh.length)}/${fresh.length})   `);
  }
  console.log();
  return picked;
}

if (!KEY) throw new Error('no TMDB key found');
const needHw = Math.max(0, TARGET_HW - haveHw), needIn = Math.max(0, TARGET_IN - haveIn);
const enCands = await candidates('en', 300, 260);
const inCands = [];
for (const l of IN_LANGS) inCands.push(...await candidates(l, 10, 120));
console.log('candidate pool: English', enCands.length, 'Indian', inCands.length);
const hw = await collect('Hollywood', 'en', enCands, needHw);
const ind = await collect('Indian', 'IN', inCands.filter(c => IN_LANGS.includes(c.original_language)), needIn);
const all = hw.concat(ind);
fs.writeFileSync(OUT, JSON.stringify(all));
console.log('wrote', all.length, 'films,', (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB; Hollywood now', haveHw + hw.length, 'Indian now', haveIn + ind.length);
