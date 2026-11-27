// Adds the films and series that TMDB lists as streaming on Hoichoi in India (provider 315, and the Hoichoi Amazon Channel 2176)
// to web_live_build/catalog_extra.json, in the same shape as the other extra titles, with no duplicates (TMDB id, or title + year).
// Series are built from TMDB tv data: seasons and episodes counted, cast from aggregate credits, director = the one with most episodes,
// else the creator. Blank stays blank (nothing is invented). Titles need a poster, a backdrop, a synopsis and at least 2 votes
// (fewer votes would show a rating nobody gave).
// Run: node scripts/add_hoichoi.mjs [--dry]      (needs internet)
import fs from 'node:fs';
import path from 'node:path';
import { readCore } from './_core.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'web_live_build', 'catalog_extra.json');
const KEY = (fs.readFileSync(path.join(ROOT, 'web_live_build', 'index.html'), 'utf8').match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const API = 'https://api.themoviedb.org/3';
const DRY = process.argv.includes('--dry');
const PROV = '315|2176';
const MIN_VOTES = 2;
const REGION = { bn: 'Indian (Bengali)', hi: 'Indian (Bollywood)', ta: 'Indian (Kollywood)', te: 'Indian (Tollywood)', ml: 'Indian (Mollywood)', kn: 'Indian (Sandalwood)', mr: 'Indian (Marathi)', pa: 'Indian (Punjabi)', gu: 'Indian (Gujarati)', ur: 'Pakistani (Urdu)', en: 'Hollywood / Western' };
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
if (!KEY) throw new Error('no TMDB key found');

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

function build(d, isTv) {
  const lang = d.original_language; if (!REGION[lang]) return null;
  const credits = isTv ? d.aggregate_credits : d.credits;
  const cast = ((credits && credits.cast) || []).slice(0, 8).map(c => c.name).filter(Boolean).slice(0, 5);
  let director = '';
  if (isTv) {
    const crew = ((credits && credits.crew) || []).filter(c => (c.jobs || []).some(j => j.job === 'Director')).sort((a, b) => (b.total_episode_count || 0) - (a.total_episode_count || 0));
    director = (crew[0] || {}).name || ((d.created_by || [])[0] || {}).name || '';
  } else director = (((credits && credits.crew) || []).find(c => c.job === 'Director') || {}).name || '';
  const title = isTv ? d.name : d.title;
  const year = ((isTv ? d.first_air_date : d.release_date) || '').slice(0, 4);
  const votes = d.vote_count || 0;
  if (!d.poster_path || !d.backdrop_path || !d.overview || d.overview.length < 40 || !/^\d{4}$/.test(year) || votes < MIN_VOTES || cast.length < 2) return null;
  const genres = (d.genres || []).map(g => GENRE[g.name] || g.name).slice(0, 3); if (!genres.length) return null;
  let duration;
  if (isTv) { const s = d.number_of_seasons || 0; if (!s) return null; duration = s + (s === 1 ? ' Season' : ' Seasons'); }
  else { const rt = d.runtime || 0; if (!rt) return null; duration = `${Math.floor(rt / 60)}h ${String(rt % 60).padStart(2, '0')}m`.replace(/^0h /, ''); }
  const rating = Math.round(((votes * (d.vote_average || 0) + 100 * 6.3) / (votes + 100)) * 10) / 10;
  const dom = vibeFor(genres, rating, votes), quality = rating >= 8 ? 'an exceptional' : rating >= 7 ? 'a well-loved' : rating >= 6 ? 'an enjoyable' : 'a divisive';
  const alts = (((d.alternative_titles || {}).titles || (d.alternative_titles || {}).results) || []).map(t => t.title).concat([isTv ? d.original_name : d.original_title]).filter(t => t && /[a-z]/i.test(t) && norm(t) !== norm(title) && t.length <= 60);
  const item = {
    id: slug(title) + '-' + d.id, tmdbId: d.id, title, type: isTv ? 'Series' : 'Movie', year, language: lang, region: REGION[lang],
    genres, duration, director, cast,
    poster: 'https://image.tmdb.org/t/p/w500' + d.poster_path, backdrop: 'https://image.tmdb.org/t/p/w1280' + d.backdrop_path, synopsis: d.overview, rating,
    vibeReality: `Audiences describe ${title} as ${quality} ${genres[0]} experience${rating >= 7 ? ' with verified cinematic quality' : ''}.`,
    totalVotes: votes, dominantVibe: dom, vibeVotes: { [dom]: Math.round(votes * 0.55), [SECOND[dom]]: Math.round(votes * 0.30), [THIRD[dom]]: Math.round(votes * 0.15) }
  };
  if (isTv) { item.seasonsCount = d.number_of_seasons; item.episodesCount = d.number_of_episodes || 0; }
  if (alts.length) item.alt = [...new Set(alts)].slice(0, 3);
  return item;
}

const core = readCore(ROOT);
const extra = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const haveId = new Set(), haveKey = new Set();
[...core, ...extra].forEach(m => { if (m.tmdbId) haveId.add((m.type === 'Series' ? 't' : 'm') + m.tmdbId); haveKey.add(norm(m.title) + '|' + m.year); });
console.log('already have', core.length, 'built-in +', extra.length, 'extra');

const added = [], stats = {};
for (const kind of ['movie', 'tv']) {
  const isTv = kind === 'tv', k = isTv ? 't' : 'm';
  const url = p => `${API}/discover/${kind}?api_key=${KEY}&watch_region=IN&with_watch_providers=${encodeURIComponent(PROV)}&with_watch_monetization_types=flatrate&sort_by=popularity.desc&page=${p}`;
  const first = await get(url(1)); if (!first) continue;
  const list = [...first.results];
  const rest = await pool(Array.from({ length: Math.min(first.total_pages, 40) - 1 }, (_, i) => i + 2), 6, p => get(url(p)));
  rest.forEach(r => r && list.push(...r.results));
  const fresh = list.filter(c => !haveId.has(k + c.id));
  const det = await pool(fresh, 10, c => get(`${API}/${kind}/${c.id}?api_key=${KEY}&language=en-US&append_to_response=${isTv ? 'aggregate_credits,alternative_titles' : 'credits,alternative_titles'}`));
  let skipped = 0, dup = 0;
  det.forEach(d => {
    if (!d) { skipped++; return; }
    const it = build(d, isTv); if (!it) { skipped++; return; }
    const key = norm(it.title) + '|' + it.year; if (haveKey.has(key)) { dup++; return; }
    haveKey.add(key); haveId.add(k + d.id); added.push(it);
  });
  stats[kind] = { onHoichoi: list.length, alreadyHad: list.length - fresh.length, tried: fresh.length, added: added.filter(a => (a.type === 'Series') === isTv).length, skipped, dupTitle: dup };
}
console.log(JSON.stringify(stats, null, 1));
const byLang = {}; added.forEach(a => byLang[a.language] = (byLang[a.language] || 0) + 1); console.log('added by language', JSON.stringify(byLang));
if (!DRY) { fs.writeFileSync(OUT, JSON.stringify(extra.concat(added))); console.log('catalog_extra.json now', extra.length + added.length, 'titles,', (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB'); } else console.log('dry run: nothing written');
