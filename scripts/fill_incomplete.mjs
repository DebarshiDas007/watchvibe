// Fills blanks in the built-in catalogue (catalog_core.js) from TMDB, and only the blanks: it never overwrites a value that is already there.
//   Series: cast (top 5 from aggregate credits), director (the director with most episodes, else the creators), synopsis.
//   Movies: cast (top 5), director, synopsis.
//   Stand-up specials are left alone: a special's cast really is just the comedian.
// Anything TMDB does not know stays blank (rule: never invent data).
// Run: node scripts/fill_incomplete.mjs [--dry]   (needs internet)
import fs from 'node:fs';
import path from 'node:path';
import { readCore, writeCore } from './_core.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const KEY = (fs.readFileSync(path.join(ROOT, 'web_live_build', 'index.html'), 'utf8').match(/DEFAULT_TMDB_KEY = '([0-9a-f]+)'/) || [])[1];
const API = 'https://api.themoviedb.org/3';
const DRY = process.argv.includes('--dry');
if (!KEY) throw new Error('no TMDB key found');

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

const core = readCore(ROOT);
const needs = m => {
  if (m.type === 'Stand-Up') return false;
  return !m.director || !m.cast || m.cast.length < 3 || !m.synopsis || m.synopsis.length < 40;
};
const todo = core.filter(needs);
console.log('entries with gaps:', todo.length);

const report = [];
for (const m of todo) {
  const isTv = m.type === 'Series';
  const base = `${API}/${isTv ? 'tv' : 'movie'}/${m.tmdbId}?api_key=${KEY}&language=en-US&append_to_response=${isTv ? 'aggregate_credits' : 'credits'}`;
  const d = await get(base);
  if (!d) { report.push(`${m.title} (${m.year}): TMDB did not answer`); continue; }
  const credits = isTv ? d.aggregate_credits : d.credits;
  const changed = [];
  // cast: top 5 by billing order, only when TMDB has more than we hold
  const names = ((credits && credits.cast) || []).slice(0, 8).map(c => c.name).filter(Boolean).slice(0, 5);
  if ((!m.cast || m.cast.length < 3) && names.length > (m.cast || []).length) { m.cast = names; changed.push('cast'); }
  // director
  if (!m.director) {
    let dir = '';
    if (isTv) {
      const crew = ((credits && credits.crew) || []).filter(c => (c.jobs || []).some(j => j.job === 'Director'));
      crew.sort((a, b) => (b.total_episode_count || 0) - (a.total_episode_count || 0));
      dir = (crew[0] || {}).name || '';
      if (!dir) dir = ((d.created_by || [])[0] || {}).name || '';
    } else {
      dir = (((credits && credits.crew) || []).find(c => c.job === 'Director') || {}).name || '';
    }
    if (dir) { m.director = dir; changed.push('director'); }
  }
  // synopsis
  if ((!m.synopsis || m.synopsis.length < 40) && d.overview && d.overview.length >= 40) { m.synopsis = d.overview; changed.push('synopsis'); }
  const left = [];
  if (!m.director) left.push('director');
  if (!m.cast || m.cast.length < 3) left.push('cast<3');
  if (!m.synopsis || m.synopsis.length < 40) left.push('synopsis');
  report.push(`${m.title} (${m.year}, ${m.type}): filled ${changed.join('+') || 'nothing'}${left.length ? '; still blank: ' + left.join(', ') : ''}`);
}
console.log(report.join('\n'));
const stillOpen = core.filter(needs).length;
console.log(`\nfilled something in ${report.filter(r => !/filled nothing/.test(r) && !/did not answer/.test(r)).length}; entries still with a gap: ${stillOpen}`);
if (!DRY) { writeCore(ROOT, core); console.log('catalog_core.js written (version raised)'); } else console.log('dry run: nothing written');
