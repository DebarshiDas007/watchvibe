// Adds TV series in one original language (default Bengali) to web_live_build/catalog_extra.json, no duplicates (TMDB id, or title + year).
// Same shape and rules as add_hoichoi.mjs: seasons and episodes counted, cast from aggregate credits, director = the one with most episodes,
// else the creator; poster, synopsis, year and 2+ cast needed; blank stays blank; under 2 votes means rating 0 (never a made-up score);
// no backdrop on TMDB: the poster stands in.
// Run: node scripts/add_series_lang.mjs [lang] [howMany] [minVotes] [--dry]     e.g.  node scripts/add_series_lang.mjs bn 300 0
import fs from 'node:fs';
import path from 'node:path';
import { readCore } from './_core.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'web_live_build', 'catalog_extra.json');
const KEY = (fs.readFileSync(path.join(ROOT, 'web_live_build', 'index.html'), 'utf8').match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const API = 'https://api.themoviedb.org/3';
const args = process.argv.slice(2).filter(a => a !== '--dry');
const DRY = process.argv.includes('--dry');
const LANG = args[0] || 'bn', NEED = Number(args[1]) || 300, MIN_VOTES = args[2] !== undefined ? Number(args[2]) : 0;
const REGION = { bn: 'Indian (Bengali)', hi: 'Indian (Bollywood)', ta: 'Indian (Kollywood)', te: 'Indian (Tollywood)', ml: 'Indian (Mollywood)', kn: 'Indian (Sandalwood)', mr: 'Indian (Marathi)', pa: 'Indian (Punjabi)', gu: 'Indian (Gujarati)', ur: 'Pakistani (Urdu)' };
if (!REGION[LANG]) throw new Error('language not supported: ' + LANG);
if (!KEY) throw new Error('no TMDB key found');
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

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
  if (['Sci-Fi', 'Mystery', 'Sci-Fi & Fantasy'].includes(g)) return 'mind_blown';
  if (['Horror', 'Thriller', 'Crime'].includes(g)) return rating >= 7 ? 'must_watch' : 'mind_blown';
  if (g === 'Documentary') return 'must_watch';
  return rating >= 7.4 ? 'must_watch' : (g === 'Action' || g === 'Adventure' || g === 'Action & Adventure' ? 'fun_time' : 'mind_blown');
}
const SECOND = { must_watch: 'mind_blown', mind_blown: 'must_watch', fun_time: 'must_watch', emotional_damage: 'must_watch', hidden_gem: 'must_watch' };
const THIRD = { must_watch: 'fun_time', mind_blown: 'fun_time', fun_time: 'mind_blown', emotional_damage: 'mind_blown', hidden_gem: 'mind_blown' };

function build(d) {
  const credits = d.aggregate_credits;
  const cast = ((credits && credits.cast) || []).slice(0, 8).map(c => c.name).filter(Boolean).slice(0, 5);
  const crew = ((credits && credits.crew) || []).filter(c => (c.jobs || []).some(j => j.job === 'Director')).sort((a, b) => (b.total_episode_count || 0) - (a.total_episode_count || 0));
  const director = (crew[0] || {}).name || ((d.created_by || [])[0] || {}).name || '';
  const title = d.name, year = (d.first_air_date || '').slice(0, 4), votes = d.vote_count || 0;
  if (!d.poster_path || !d.overview || d.overview.length < 40 || !/^\d{4}$/.test(year) || votes < MIN_VOTES || cast.length < 2) return null;
  const genres = (d.genres || []).map(g => GENRE[g.name] || g.name).slice(0, 3); if (!genres.length) return null;
  const s = d.number_of_seasons || 0; if (!s) return null;
  const rating = votes < 2 ? 0 : Math.round(((votes * (d.vote_average || 0) + 100 * 6.3) / (votes + 100)) * 10) / 10;
  const dom = vibeFor(genres, rating, votes), quality = rating >= 8 ? 'an exceptional' : rating >= 7 ? 'a well-loved' : rating >= 6 ? 'an enjoyable' : 'a divisive';
  const alts = (((d.alternative_titles || {}).results) || ((d.alternative_titles || {}).titles) || []).map(t => t.title).concat([d.original_name]).filter(t => t && /[a-z]/i.test(t) && norm(t) !== norm(title) && t.length <= 60);
  const item = {
    id: slug(title) + '-' + d.id, tmdbId: d.id, title, type: 'Series', year, language: LANG, region: REGION[LANG],
    genres, duration: s + (s === 1 ? ' Season' : ' Seasons'), director, cast,
    poster: 'https://image.tmdb.org/t/p/w500' + d.poster_path,
    backdrop: d.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + d.backdrop_path : 'https://image.tmdb.org/t/p/w780' + d.poster_path,
    synopsis: d.overview, rating,
    vibeReality: `Audiences describe ${title} as ${quality} ${genres[0]} experience${rating >= 7 ? ' with verified cinematic quality' : ''}.`,
    totalVotes: votes, dominantVibe: dom, vibeVotes: { [dom]: Math.round(votes * 0.55), [SECOND[dom]]: Math.round(votes * 0.30), [THIRD[dom]]: Math.round(votes * 0.15) },
    seasonsCount: d.number_of_seasons, episodesCount: d.number_of_episodes || 0
  };
  if (alts.length) item.alt = [...new Set(alts)].slice(0, 3);
  return item;
}

const core = readCore(ROOT);
const extra = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const haveId = new Set(), haveKey = new Set();
[...core, ...extra].forEach(m => { if (m.tmdbId && m.type === 'Series') haveId.add(String(m.tmdbId)); haveKey.add(norm(m.title) + '|' + m.year); });
console.log('already have', core.length, 'built-in +', extra.length, 'extra');

const url = p => `${API}/discover/tv?api_key=${KEY}&with_original_language=${LANG}&sort_by=vote_count.desc&include_adult=false&page=${p}`;
const first = await get(url(1)); if (!first) throw new Error('TMDB did not answer');
const list = [...first.results];
const rest = await pool(Array.from({ length: Math.min(first.total_pages, 40) - 1 }, (_, i) => i + 2), 6, p => get(url(p)));
rest.forEach(r => r && list.push(...r.results));
const fresh = list.filter(c => !haveId.has(String(c.id)));
const added = []; let skipped = 0, dup = 0;
for (let i = 0; i < fresh.length && added.length < NEED; i += 40) {
  const det = await pool(fresh.slice(i, i + 40), 10, c => get(`${API}/tv/${c.id}?api_key=${KEY}&language=en-US&append_to_response=aggregate_credits,alternative_titles`));
  det.forEach(d => {
    if (!d || added.length >= NEED) { if (!d) skipped++; return; }
    const it = build(d); if (!it) { skipped++; return; }
    const k = norm(it.title) + '|' + it.year; if (haveKey.has(k)) { dup++; return; }
    haveKey.add(k); haveId.add(String(d.id)); added.push(it);
  });
}
console.log(LANG, 'on TMDB', list.length, 'already had', list.length - fresh.length, 'tried', fresh.length, 'added', added.length, 'skipped', skipped, 'same title+year', dup);
if (!DRY) { fs.writeFileSync(OUT, JSON.stringify(extra.concat(added))); console.log('catalog_extra.json now', extra.length + added.length, 'titles,', (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB'); } else console.log('dry run: nothing written');
