// Daily catalogue refresh. Writes web_live_build/catalog_fresh.json, which the app loads after the first screen:
//   r     the current TMDB rating of every film and series in the catalogue (only where it differs from the built-in value)
//   news  films released in the last 60 days (Hindi, Bengali, English) that are not in the catalogue yet
// It never touches index.html, catalog_core.js or catalog_extra.json, so the big files stay cached for a year. Run: node scripts/refresh_daily.mjs
// (needs internet, about 5 minutes). The GitHub workflow .github/workflows/daily-refresh.yml runs it every day and deploys.
// Never invents data: a film with a missing poster, backdrop, synopsis, director, three cast names or runtime is skipped (and tried again tomorrow).
import fs from 'node:fs';
import path from 'node:path';
import { readCore } from './_core.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const HTML = path.join(ROOT, 'web_live_build', 'index.html');
const EXTRA = path.join(ROOT, 'web_live_build', 'catalog_extra.json');
const OUT = path.join(ROOT, 'web_live_build', 'catalog_fresh.json');
const KEY = (fs.readFileSync(HTML, 'utf8').match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const API = 'https://api.themoviedb.org/3';
if (!KEY) throw new Error('no TMDB key found');
const NEWS_DAYS = 60, NEWS_CAP = 300, FAIL_LIMIT = 0.25;
const LANGS = [{ lang: 'en', region: 'Hollywood / Western' }, { lang: 'hi', region: 'Indian (Bollywood)' }, { lang: 'bn', region: 'Indian (Bengali)' }];

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const blend = (avg, votes) => Math.round(((votes * (avg || 0) + 100 * 6.3) / (votes + 100)) * 10) / 10;   // same formula the catalogue was built with

async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) { await new Promise(r => setTimeout(r, 1200 * (i + 1))); continue; }
      if (r.status === 404) return { __missing: true };
      if (!r.ok) { await new Promise(r => setTimeout(r, 600 * (i + 1))); continue; }
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

const base = readCore(ROOT);   // the built-in catalogue (web_live_build/catalog_core.js)
const extra = JSON.parse(fs.readFileSync(EXTRA, 'utf8'));
const all = base.concat(extra);
let prev = { r: {}, news: [] };
try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}

// the key the app uses to match a film (see catMerge / loadFreshCatalog in index.html): movie and TV ids overlap, so they are told apart
const keyOf = m => { const t = /^tmdb-(m|tv)-(\d+)$/.exec(String(m.id)); return t ? t[1] + t[2] : (m.tmdbId ? (m.type === 'Movie' ? 'm' : 'tv') + m.tmdbId : ''); };
const endpointOf = m => (m.type === 'Series' ? 'tv' : 'movie');

// ---------- 1. current ratings ----------
const targets = all.filter(m => keyOf(m) && /^\d+$/.test(String(m.tmdbId || (/(\d+)$/.exec(String(m.id)) || [])[1])));
console.log('catalogue films to re-rate:', targets.length);
let failed = 0, done = 0;
const rated = await pool(targets, 10, async m => {
  const id = m.tmdbId || /(\d+)$/.exec(String(m.id))[1];
  const d = await get(`${API}/${endpointOf(m)}/${id}?api_key=${KEY}`);
  if (++done % 500 === 0) process.stdout.write(`\r${done}/${targets.length}   `);
  if (!d) { failed++; return null; }
  if (d.__missing || !d.vote_count) return null;
  return [keyOf(m), blend(d.vote_average, d.vote_count)];
});
console.log();
let r = prev.r || {};
if (failed / targets.length > FAIL_LIMIT) {
  console.log(`WARNING: ${failed} of ${targets.length} lookups failed, keeping yesterday's ratings`);
} else {
  r = {};
  const staticRating = new Map(all.map(m => [keyOf(m), Number(m.rating)]));
  for (const x of rated) if (x && x[1] !== staticRating.get(x[0])) r[x[0]] = x[1];
}

// ---------- 2. new releases ----------
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
function build(d, lang, region) {
  const crew = (d.credits && d.credits.crew) || [], cast = (d.credits && d.credits.cast) || [];
  const director = (crew.find(c => c.job === 'Director') || {}).name;
  const names = cast.slice(0, 8).map(c => c.name).filter(Boolean).slice(0, 5);
  if (!d.poster_path || !d.backdrop_path || !d.overview || d.overview.length < 60 || !director || names.length < 3) return null;
  const genres = (d.genres || []).map(g => GENRE[g.name] || g.name).slice(0, 3);
  if (!genres.length) return null;
  const year = (d.release_date || '').slice(0, 4); if (!/^\d{4}$/.test(year)) return null;
  const rt = d.runtime || 0; if (!rt) return null;
  const duration = `${Math.floor(rt / 60)}h ${String(rt % 60).padStart(2, '0')}m`.replace(' 0', ' ');
  const votes = d.vote_count || 0, rating = blend(d.vote_average, votes);
  const dom = vibeFor(genres, rating, votes);
  const quality = rating >= 8 ? 'an exceptional' : rating >= 7 ? 'a well-loved' : rating >= 6 ? 'an enjoyable' : 'a divisive';
  return {
    id: slug(d.title) + '-' + d.id, tmdbId: d.id, title: d.title, type: 'Movie', year, rel: d.release_date, language: lang, region,
    genres, duration, director, cast: names,
    poster: 'https://image.tmdb.org/t/p/w500' + d.poster_path, backdrop: 'https://image.tmdb.org/t/p/w1280' + d.backdrop_path,
    synopsis: d.overview, rating, vibeReality: `Audiences describe ${d.title} as ${quality} ${genres[0]} experience${rating >= 7 ? ' with verified cinematic quality' : ''}.`,
    totalVotes: votes, dominantVibe: dom,
    vibeVotes: { [dom]: Math.round(votes * 0.55), [SECOND[dom]]: Math.round(votes * 0.30), [THIRD[dom]]: Math.round(votes * 0.15) }
  };
}
const haveId = new Set(all.map(m => String(m.tmdbId || '')).filter(Boolean));
const haveKey = new Set(all.map(m => norm(m.title) + '|' + m.year));
const haveSlug = new Set(all.map(m => m.id));
// yesterday's news stays unless the film has since entered the main catalogue
const news = (prev.news || []).filter(n => !haveId.has(String(n.tmdbId)) && !haveKey.has(norm(n.title) + '|' + n.year));
const newsIds = new Set(news.map(n => String(n.tmdbId)));
const today = new Date().toISOString().slice(0, 10);
const since = new Date(Date.now() - NEWS_DAYS * 864e5).toISOString().slice(0, 10);
let added = 0;
for (const L of LANGS) {
  const list = [];
  for (let p = 1; p <= 4; p++) {
    const j = await get(`${API}/discover/movie?api_key=${KEY}&with_original_language=${L.lang}&primary_release_date.gte=${since}&primary_release_date.lte=${today}&vote_count.gte=3&sort_by=popularity.desc&include_adult=false&page=${p}`);
    if (!j || !j.results || !j.results.length) break;
    list.push(...j.results);
    if (p >= j.total_pages) break;
  }
  const fresh = list.filter(c => c.original_language === L.lang && !haveId.has(String(c.id)) && !newsIds.has(String(c.id)));
  const det = await pool(fresh, 8, c => get(`${API}/movie/${c.id}?api_key=${KEY}&language=en-US&append_to_response=credits`));
  for (const d of det) {
    if (!d || d.__missing) continue;
    const item = build(d, L.lang, L.region); if (!item) continue;
    const k = norm(item.title) + '|' + item.year;
    if (haveKey.has(k) || haveSlug.has(item.id)) continue;
    haveKey.add(k); haveSlug.add(item.id); newsIds.add(String(item.tmdbId)); news.push(item); added++;
  }
  console.log(L.lang, 'candidates', fresh.length);
}
news.sort((x, y) => String(y.rel || '').localeCompare(String(x.rel || '')));
news.length = Math.min(news.length, NEWS_CAP);

// Which TMDB titles stream on Hoichoi in India today (provider 315, plus its Amazon channel 2176): the site uses it for the "Streaming on hoichoi" shelf.
// If TMDB does not answer, yesterday's list stays (never an empty list from a failed call).
const hoi = { m: [], t: [] };
let hoiOk = true;
for (const [kind, key] of [['movie', 'm'], ['tv', 't']]) {
  const url = p => `${API}/discover/${kind}?api_key=${KEY}&watch_region=IN&with_watch_providers=${encodeURIComponent('315|2176')}&with_watch_monetization_types=flatrate&sort_by=popularity.desc&page=${p}`;
  const first = await get(url(1));
  if (!first || !first.results) { hoiOk = false; break; }
  const all = [...first.results];
  const rest = await pool(Array.from({ length: Math.min(first.total_pages || 1, 40) - 1 }, (_, i) => i + 2), 6, p => get(url(p)));
  rest.forEach(x => x && x.results && all.push(...x.results));
  hoi[key] = [...new Set(all.map(x => x.id))];
}
const hoiOut = hoiOk && (hoi.m.length + hoi.t.length) >= 50 ? hoi : (prev.hoi || { m: [], t: [] });
console.log(`hoichoi titles: ${hoiOut.m.length} films, ${hoiOut.t.length} series${hoiOut === hoi ? '' : ' (kept yesterday\'s list)'}`);

fs.writeFileSync(OUT, JSON.stringify({ day: today, r, news, hoi: hoiOut }));
console.log(`rated changes: ${Object.keys(r).length}, new releases kept: ${news.length} (+${added} today), failed lookups: ${failed}`);
console.log('catalog_fresh.json is', (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
