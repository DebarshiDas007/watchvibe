// Builds the crawlable pages that search engines (and people without JavaScript) can read:
//   web_live_build/film/<id>.html          one page per film or series (title, synopsis, cast, facts, similar films, structured data)
//   web_live_build/best/<hub>.html         "best of" lists by genre, language and type (+ /best index)
//   web_live_build/sitemap.xml + sitemap-main.xml + sitemap-films-N.xml, robots.txt
// All data comes from the catalogue the app already has (index.html + catalog_extra.json + today's catalog_fresh.json). Nothing is invented:
// a fact that is missing is simply left out. The site address lives in scripts/seo.config.json: change it, run this again, done.
// Run: node scripts/build_seo.mjs   (deploy.py runs it before every deploy; the generated files are not committed)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const WEB = path.join(ROOT, 'web_live_build');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'seo.config.json'), 'utf8'));
const SITE = CFG.siteUrl.replace(/\/+$/, ''), NAME = CFG.siteName;

// ---------- data ----------
const src = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const a = src.indexOf('let mediaDatabase = ['), b = src.indexOf('];', a);
const base = JSON.parse(src.slice(a + 'let mediaDatabase = '.length, b + 1));
const extra = JSON.parse(fs.readFileSync(path.join(WEB, 'catalog_extra.json'), 'utf8'));
let fresh = { r: {}, news: [] };
try { fresh = JSON.parse(fs.readFileSync(path.join(WEB, 'catalog_fresh.json'), 'utf8')); } catch (e) {}
const keyOf = m => (m.tmdbId ? (m.type === 'Movie' ? 'm' : 'tv') + m.tmdbId : '');
const builtIn = new Set(base.map(m => m.id));
const seen = new Set(), all = [];
for (const m of base.concat(extra, fresh.news || [])) {
  if (!m || !m.id || seen.has(m.id)) continue; seen.add(m.id);
  const k = keyOf(m); if (k && typeof fresh.r[k] === 'number') m.rating = fresh.r[k];   // today's rating
  all.push(m);
}

// ---------- helpers ----------
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ldJson = o => JSON.stringify(o).replace(/</g, '\\u003c');
const flat = s => String(s || '').replace(/\s+/g, ' ').trim();
function cut(s, n) { s = flat(s); if (s.length <= n) return s; const c = s.slice(0, n - 1), i = c.lastIndexOf(' '); return (i > n * 0.6 ? c.slice(0, i) : c).replace(/[\s,;:.\-]+$/, '') + '…'; }
const LANG = { en: 'English', hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', mr: 'Marathi', pa: 'Punjabi', gu: 'Gujarati', ur: 'Urdu', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese', ru: 'Russian', ar: 'Arabic', tr: 'Turkish', th: 'Thai', id: 'Indonesian', pl: 'Polish', nl: 'Dutch', sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', he: 'Hebrew', fa: 'Persian' };
const langName = c => LANG[c] || '';
const SKIP_GENRE = /^(Trending|Cinema|Series|Movie|Stand-?Up)$/i;
const genresOf = m => (m.genres || []).filter(g => g && !SKIP_GENRE.test(g));
const typeWord = m => m.type === 'Series' ? 'TV series' : m.type === 'Stand-Up' ? 'stand-up special' : 'film';
const goodName = v => v && !/^(Director|Showrunner)$/i.test(String(v).trim());
const nf = n => Number(n).toLocaleString('en-US');
const thumb = (u, w) => String(u || '').replace(/\/t\/p\/w\d+\//, '/t/p/w' + w + '/');
const isoDuration = d => { const m = /^(?:(\d+)h)?\s*(?:(\d+)m)?$/.exec(String(d || '').trim()); return m && (m[1] || m[2]) ? 'PT' + (m[1] ? m[1] + 'H' : '') + (m[2] ? m[2] + 'M' : '') : ''; };
const cssHash = crypto.createHash('sha1').update(fs.readFileSync(path.join(WEB, 'seo.css'), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

// ---------- which films get a page ----------
const ok = m => /^[a-z0-9-]{3,120}$/.test(m.id) && m.title && /^\d{4}$/.test(String(m.year)) && m.poster && flat(m.synopsis).length >= 60 && (builtIn.has(m.id) || (m.totalVotes || 0) >= CFG.minVotes);
const films = all.filter(ok).sort((x, y) => (y.totalVotes || 0) - (x.totalVotes || 0));
const byId = new Map(films.map(m => [m.id, m]));
console.log(`catalogue ${all.length}, pages for ${films.length}`);

// ---------- hubs ("best of" lists) ----------
const hubs = [];   // { slug, title, h1, intro, items, group }
const rankSort = list => list.slice().sort((x, y) => (Number(y.rating) - Number(x.rating)) || ((y.totalVotes || 0) - (x.totalVotes || 0)));
function addHub(slugName, h1, noun, list, group) {
  if (list.length < 8) return;
  let pool = list.filter(m => (m.totalVotes || 0) >= 150); if (pool.length < 30) pool = list.filter(m => (m.totalVotes || 0) >= 40); if (pool.length < 12) pool = list;
  const items = rankSort(pool).slice(0, CFG.hubSize);
  hubs.push({ slug: slugName, h1, noun, items, total: list.length, group });
}
const movies = films.filter(m => m.type === 'Movie'), series = films.filter(m => m.type === 'Series'), standup = films.filter(m => m.type === 'Stand-Up');
addHub('movies', 'Best movies', 'movies', movies, 'main');
addHub('series', 'Best TV series', 'TV series', series, 'main');
addHub('stand-up', 'Best stand-up specials', 'stand-up specials', standup, 'main');
const gCount = new Map(); movies.forEach(m => genresOf(m).forEach(g => gCount.set(g, (gCount.get(g) || 0) + 1)));
[...gCount.entries()].filter(([, n]) => n >= CFG.hubMinFilms).sort((x, y) => y[1] - x[1]).forEach(([g]) => addHub(slug(g) + '-movies', `Best ${g} movies`, `${g.toLowerCase()} movies`, movies.filter(m => genresOf(m).includes(g)), 'genre'));
const lCount = new Map(); movies.forEach(m => { const n = langName(m.language); if (n) lCount.set(n, (lCount.get(n) || 0) + 1); });
[...lCount.entries()].filter(([, n]) => n >= CFG.hubMinFilms).sort((x, y) => y[1] - x[1]).forEach(([n]) => addHub(slug(n) + '-movies', `Best ${n} movies`, `${n} movies`, movies.filter(m => langName(m.language) === n), 'language'));
const hubBySlug = new Map(hubs.map(h => [h.slug, h]));
const hubUrl = h => `${SITE}/best/${h.slug}`;

// ---------- page shell ----------
const NAV = [['movies', 'Best movies'], ['series', 'TV series'], ['hindi-movies', 'Hindi'], ['bengali-movies', 'Bengali']].filter(([s]) => hubBySlug.has(s));
function shell({ title, desc, url, image, ld, body, type }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="${type || 'website'}">
<meta property="og:site_name" content="${esc(NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:image" content="${esc(image)}">\n` : ''}<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="theme-color" content="#090909">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" as="font" type="font/woff2" crossorigin href="/vendor/fonts/switzer-400.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin href="/vendor/fonts/cabinet-grotesk-800.woff2">
<link rel="stylesheet" href="/seo.css?v=${cssHash}">
<script type="application/ld+json">${ldJson(ld)}</script>
</head>
<body>
<header class="sp-top"><a class="sp-brand" href="/">WATCH<b>VIBE</b></a><nav class="sp-nav" aria-label="Browse">${NAV.map(([s, l]) => `<a href="/best/${s}">${esc(l)}</a>`).join('')}<a href="/">Open ${esc(NAME)}</a></nav></header>
<main class="sp">
${body}
</main>
<footer class="sp-foot"><a href="/">${esc(NAME)}</a> &middot; <a href="/best/">Best of</a> &middot; <a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a>
<p>Film and TV data and images are provided by TMDB. ${esc(NAME)} uses the TMDB API but is not endorsed or certified by TMDB.</p></footer>
</body>
</html>
`;
}
const card = (m, rank) => `<li><a class="sp-card${rank ? ' sp-rank' : ''}" href="/film/${m.id}"><span class="sp-poster"><img src="${esc(thumb(m.poster, 185))}" alt="Poster of ${esc(m.title)}" width="185" height="278" loading="lazy" decoding="async">${rank ? `<span class="sp-no" aria-hidden="true">${String(rank).padStart(2, '0')}</span>` : ''}</span><b>${esc(m.title)}</b><small>${esc(m.year)}${genresOf(m)[0] ? ' &middot; ' + esc(genresOf(m)[0]) : ''}</small></a></li>`;

// ---------- "more like this": real similarity (shared genres, same director, shared cast, same language, close in year, a little popularity) ----------
const byGenre = new Map(); films.forEach(m => genresOf(m).forEach(g => { const k = m.type + '|' + g; (byGenre.get(k) || byGenre.set(k, []).get(k)).push(m); }));
const castSet = m => new Set((m.cast || []).map(c => String(c).toLowerCase()));
const inboundLinks = new Map();   // keeps one popular film from being linked from everywhere
function similar(m) {
  const g = genresOf(m); if (!g.length) return [];
  const cand = new Set(); g.forEach(x => (byGenre.get(m.type + '|' + x) || []).forEach(c => { if (c !== m) cand.add(c); }));
  const mc = castSet(m), mg = new Set(g), dir = goodName(m.director) ? m.director : '';
  const scored = [];
  for (const c of cand) {
    const cg = genresOf(c); let inter = 0; cg.forEach(x => { if (mg.has(x)) inter++; });
    const jac = inter / (mg.size + cg.length - inter);
    let castHit = 0; (c.cast || []).forEach(x => { if (mc.has(String(x).toLowerCase())) castHit++; });
    const s = 3 * jac + (dir && c.director === dir ? 2 : 0) + 1.2 * Math.min(2, castHit) + (c.language === m.language ? 0.9 : 0) - Math.min(30, Math.abs(Number(c.year) - Number(m.year))) * 0.03 + 0.25 * Math.log10((c.totalVotes || 0) + 10) / 5 - 0.002 * (inboundLinks.get(c.id) || 0);
    scored.push([s, c]);
  }
  scored.sort((x, y) => (y[0] - x[0]) || String(x[1].id).localeCompare(String(y[1].id)));
  const out = scored.slice(0, 8).map(x => x[1]); out.forEach(c => inboundLinks.set(c.id, (inboundLinks.get(c.id) || 0) + 1));
  return out;
}

// ---------- film pages ----------
fs.rmSync(path.join(WEB, 'film'), { recursive: true, force: true }); fs.mkdirSync(path.join(WEB, 'film'), { recursive: true });
fs.rmSync(path.join(WEB, 'best'), { recursive: true, force: true }); fs.mkdirSync(path.join(WEB, 'best'), { recursive: true });
function filmPage(m) {
  const url = `${SITE}/film/${m.id}`, gens = genresOf(m), lang = langName(m.language), cast = (m.cast || []).filter(Boolean).slice(0, 5), dir = goodName(m.director) ? m.director : '';
  const votes = Number(m.totalVotes) || 0, rating = Number(m.rating) || 0;
  const lead = `${m.title} is a ${m.year} ${lang ? lang + '-language ' : ''}${gens.length ? gens.slice(0, 3).join(', ').toLowerCase() + ' ' : ''}${typeWord(m)}${dir ? ` directed by ${dir}` : ''}${cast.length ? `, starring ${cast.slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' and $1')}` : ''}.${rating && votes >= 50 ? ` Audience rating: ${rating.toFixed(1)} out of 10 from ${nf(votes)} votes.` : ''}`;
  let title = `${m.title} (${m.year}): Where to Watch, Rating & Cast | ${NAME}`; if (title.length > 66) title = `${m.title} (${m.year}): Where to Watch & Cast | ${NAME}`; if (title.length > 66) title = cut(m.title, 34) + ` (${m.year}) | ${NAME}`;
  const desc = cut(`${m.title} (${m.year}), ${gens[0] ? gens[0].toLowerCase() + ' ' : ''}${typeWord(m)}. ${flat(m.synopsis)}`, 156);
  const sim = similar(m), hub = m.type === 'Movie' && gens[0] && hubBySlug.get(slug(gens[0]) + '-movies') ? hubBySlug.get(slug(gens[0]) + '-movies') : hubBySlug.get(m.type === 'Series' ? 'series' : m.type === 'Stand-Up' ? 'stand-up' : 'movies');
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': m.type === 'Series' ? 'TVSeries' : 'Movie', '@id': url + '#title', name: m.title, url, image: m.poster, description: cut(m.synopsis, 500), datePublished: String(m.year), ...(gens.length ? { genre: gens } : {}), ...(lang ? { inLanguage: m.language } : {}), ...(dir && m.type !== 'Series' ? { director: { '@type': 'Person', name: dir } } : {}), ...(cast.length ? { actor: cast.map(n => ({ '@type': 'Person', name: n })) } : {}), ...(m.type !== 'Series' && isoDuration(m.duration) ? { duration: isoDuration(m.duration) } : {}) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: NAME, item: SITE + '/' }, ...(hub ? [{ '@type': 'ListItem', position: 2, name: hub.h1, item: hubUrl(hub) }] : []), { '@type': 'ListItem', position: hub ? 3 : 2, name: m.title, item: url }] }
  ] };
  const fact = (k, v) => v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>` : '';
  const body = `<nav class="sp-crumbs" aria-label="Breadcrumb"><a href="/">${esc(NAME)}</a> / ${hub ? `<a href="/best/${hub.slug}">${esc(hub.h1)}</a> / ` : ''}${esc(cut(m.title, 50))}</nav>
<article class="sp-film">
<div class="sp-poster sp-big"><img src="${esc(thumb(m.poster, 342))}" alt="Poster of ${esc(m.title)}" width="300" height="450" fetchpriority="high"></div>
<div>
<p class="sp-eyebrow">${esc(m.type === 'Series' ? 'TV series' : m.type === 'Stand-Up' ? 'Stand-up' : 'Film')} &middot; ${esc(m.year)}${m.duration ? ' &middot; ' + esc(m.duration) : ''}</p>
<h1>${esc(m.title)}</h1>
${gens.length ? `<ul class="sp-tags">${gens.slice(0, 4).map(g => { const h = m.type === 'Movie' && hubBySlug.get(slug(g) + '-movies'); return h ? `<li><a href="/best/${h.slug}">${esc(g)}</a></li>` : `<li>${esc(g)}</li>`; }).join('')}</ul>` : ''}
<p class="sp-lead">${esc(lead)}</p>
<p class="sp-syn">${esc(flat(m.synopsis))}</p>
<dl class="sp-facts">${fact('Director', dir)}${fact('Cast', cast.join(', '))}${fact('Language', lang)}${fact(m.type === 'Series' ? 'Seasons' : 'Runtime', m.duration)}${fact('Released', m.year)}${fact('Audience rating', rating && votes >= 50 ? `${rating.toFixed(1)} / 10 (${nf(votes)} votes)` : '')}</dl>
<div class="sp-cta"><a class="sp-btn" href="/#film=${esc(m.id)}" rel="nofollow">Where to watch it &rarr;</a><span>Live streaming availability in your country, the trailer and what other viewers felt, in ${esc(NAME)}.</span></div>
</div>
</article>
${sim.length ? `<section><h2>More like ${esc(cut(m.title, 40))}</h2><ul class="sp-grid">${sim.map(s => card(s)).join('')}</ul></section>` : ''}`;
  return shell({ title, desc, url, image: m.backdrop || m.poster, ld, body, type: m.type === 'Series' ? 'video.tv_show' : 'video.movie' });
}
for (const m of films) fs.writeFileSync(path.join(WEB, 'film', m.id + '.html'), filmPage(m));

// ---------- hub pages ----------
const hubLinks = (except) => `<ul class="sp-hubs">${hubs.filter(h => h.slug !== except).map(h => `<li><a href="/best/${h.slug}">${esc(h.h1)}</a></li>`).join('')}</ul>`;
for (const h of hubs) {
  const url = hubUrl(h), n = h.items.length;
  const title = `${h.h1}: Top ${n} Rated List | ${NAME}`.replace(/(.{66}).*/, '$1');
  const desc = cut(`The ${n} best ${h.noun} in ${NAME}'s catalogue of ${nf(h.total)}, ranked by audience rating. Tap one to see where to watch it, the cast and similar picks.`, 156);
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'ItemList', name: h.h1, url, numberOfItems: n, itemListElement: h.items.slice(0, 50).map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/film/${m.id}`, name: m.title })) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: NAME, item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Best of', item: SITE + '/best/' }, { '@type': 'ListItem', position: 3, name: h.h1, item: url }] }
  ] };
  const body = `<nav class="sp-crumbs" aria-label="Breadcrumb"><a href="/">${esc(NAME)}</a> / <a href="/best/">Best of</a> / ${esc(h.h1)}</nav>
<p class="sp-eyebrow">Ranked by audience rating</p>
<h1>${esc(h.h1)}</h1>
<p class="sp-intro">The ${n} best-rated ${esc(h.noun)} in ${esc(NAME)}'s catalogue of ${nf(h.total)}. Open any title for where to watch it in your country, the cast and what to watch next.</p>
<ol class="sp-grid" style="list-style:none;padding:0">${h.items.map((m, i) => card(m, i + 1)).join('')}</ol>
<h2>More lists</h2>${hubLinks(h.slug)}`;
  fs.writeFileSync(path.join(WEB, 'best', h.slug + '.html'), shell({ title, desc, url, image: h.items[0] && (h.items[0].backdrop || h.items[0].poster), ld, body }));
}
// the index of all lists
{
  const url = SITE + '/best/', group = g => hubs.filter(h => h.group === g);
  const sect = (t, list) => list.length ? `<h2>${t}</h2><ul class="sp-hubs">${list.map(h => `<li><a href="/best/${h.slug}">${esc(h.h1)}</a></li>`).join('')}</ul>` : '';
  const body = `<nav class="sp-crumbs" aria-label="Breadcrumb"><a href="/">${esc(NAME)}</a> / Best of</nav>
<p class="sp-eyebrow">Browse</p><h1>Best movies and series</h1>
<p class="sp-intro">Lists of the best-rated films and series in ${esc(NAME)}, by genre, language and type. Every title has its own page with the cast, a synopsis and similar picks.</p>
${sect('Everything', group('main'))}${sect('By genre', group('genre'))}${sect('By language', group('language'))}`;
  fs.writeFileSync(path.join(WEB, 'best', 'index.html'), shell({ title: `Best Movies and TV Series by Genre and Language | ${NAME}`, desc: cut(`Browse the best-rated movies and TV series by genre and language, with the cast, a synopsis and where to watch each one on ${NAME}.`, 156), url, image: '', ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Best movies and series', url }, body }));
}

// ---------- sitemaps and robots ----------
const urlset = (urls) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u.loc)}</loc><lastmod>${today}</lastmod><changefreq>${u.freq || 'weekly'}</changefreq><priority>${u.pri || '0.5'}</priority></url>`).join('\n')}\n</urlset>\n`;
const main = [{ loc: SITE + '/', freq: 'daily', pri: '1.0' }, { loc: SITE + '/best/', freq: 'weekly', pri: '0.8' }, ...hubs.map(h => ({ loc: hubUrl(h), freq: 'weekly', pri: '0.8' })), { loc: SITE + '/privacy', freq: 'yearly', pri: '0.2' }, { loc: SITE + '/terms', freq: 'yearly', pri: '0.2' }];
fs.writeFileSync(path.join(WEB, 'sitemap-main.xml'), urlset(main));
for (const f of fs.readdirSync(WEB)) if (/^sitemap-films-\d+\.xml$/.test(f)) fs.rmSync(path.join(WEB, f));
const chunks = Math.ceil(films.length / CFG.sitemapChunk);
for (let i = 0; i < chunks; i++) fs.writeFileSync(path.join(WEB, `sitemap-films-${i + 1}.xml`), urlset(films.slice(i * CFG.sitemapChunk, (i + 1) * CFG.sitemapChunk).map(m => ({ loc: `${SITE}/film/${m.id}`, freq: 'monthly', pri: '0.6' }))));
const index = ['sitemap-main.xml', ...Array.from({ length: chunks }, (_, i) => `sitemap-films-${i + 1}.xml`)];
fs.writeFileSync(path.join(WEB, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${index.map(f => `  <sitemap><loc>${SITE}/${f}</loc><lastmod>${today}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
fs.writeFileSync(path.join(WEB, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin.html\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`pages: ${films.length} film, ${hubs.length + 1} list; sitemaps: ${index.length}; site ${SITE}`);
