// Checks the generated pages: unique titles and descriptions, sane lengths, valid structured data, canonical = own address, one H1,
// no leftovers like "undefined", and every internal link points at a file that exists. Exit code 1 when something is wrong.
// Run after build_seo.mjs: node scripts/check_seo.mjs
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const WEB = path.join(ROOT, 'web_live_build');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'seo.config.json'), 'utf8'));
const SITE = CFG.siteUrl.replace(/\/+$/, '');
const problems = [], titles = new Map(), descs = new Map();
const dec = s => String(s || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
let n = 0, ldKinds = {};
const exists = rel => fs.existsSync(path.join(WEB, rel.replace(/^\//, '')));
function resolveLink(h) {
  h = h.split('#')[0].split('?')[0]; if (!h || h === '/') return true;
  if (/^(https?:)?\/\//.test(h)) return true;
  if (/^\/(film|best)\/[^/]+$/.test(h)) return exists(h + '.html');
  if (h === '/best') return false;   // Cloudflare redirects /best to /best/: every link and sitemap entry must use /best/
  if (h === '/best/') return exists('best/index.html');
  return exists(h) || exists(h + '.html');
}
for (const dir of ['film', 'best']) {
  for (const f of fs.readdirSync(path.join(WEB, dir))) {
    n++; const rel = `${dir}/${f}`, html = fs.readFileSync(path.join(WEB, rel), 'utf8'), bad = m => problems.push(rel + ': ' + m);
    const t = dec((/<title>([^<]*)<\/title>/.exec(html) || [])[1]), d = dec((/<meta name="description" content="([^"]*)"/.exec(html) || [])[1]), c = (/<link rel="canonical" href="([^"]*)"/.exec(html) || [])[1];
    if (!t) bad('no title'); else { if (t.length > 70) bad('title too long (' + t.length + ')'); if (titles.has(t)) bad('duplicate title with ' + titles.get(t)); titles.set(t, rel); }
    if (!d) bad('no description'); else { if (d.length < 60 || d.length > 165) bad('description length ' + d.length); if (descs.has(d)) bad('duplicate description with ' + descs.get(d)); descs.set(d, rel); }
    const expect = dir === 'best' && f === 'index.html' ? SITE + '/best/' : `${SITE}/${dir}/${f.replace(/\.html$/, '')}`;
    if (c !== expect) bad('canonical ' + c + ' != ' + expect);
    if ((html.match(/<h1[ >]/g) || []).length !== 1) bad('needs exactly one h1');
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/\s(src|href|content)="[^"]*"/g, ''), leak = /(.{0,30})(undefined|NaN|\[object|>null<)/.exec(visible);
    if (leak) bad('contains undefined/NaN/[object]/null near: ' + leak[0]);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { const j = JSON.parse(m[1]); (j['@graph'] || [j]).forEach(x => { ldKinds[x['@type']] = (ldKinds[x['@type']] || 0) + 1; }); } catch (e) { bad('invalid JSON-LD'); } }
    for (const m of html.matchAll(/href="(\/[^"]*)"/g)) if (!resolveLink(m[1].replace(/&amp;/g, '&'))) bad('broken link ' + m[1]);
    if (/<img(?![^>]*alt=)/.test(html)) bad('image without alt');
  }
}
for (const f of fs.readdirSync(WEB).filter(x => /^sitemap.*\.xml$/.test(x))) {
  const x = fs.readFileSync(path.join(WEB, f), 'utf8');
  for (const m of x.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const u = m[1]; if (!u.startsWith(SITE)) { problems.push(f + ': foreign url ' + u); continue; }
    const p = u.slice(SITE.length) || '/'; if (f !== 'sitemap.xml' && !resolveLink(p)) problems.push(f + ': url without a page ' + u);
    if (f === 'sitemap.xml' && !exists(p)) problems.push(f + ': missing sitemap file ' + u);
  }
  if ((x.match(/<loc>/g) || []).length > 50000) problems.push(f + ': more than 50,000 urls');
}
console.log(`checked ${n} pages, structured data: ${JSON.stringify(ldKinds)}`);
if (problems.length) { console.log(problems.length + ' problem(s):'); problems.slice(0, 25).forEach(p => console.log(' - ' + p)); process.exit(1); }
console.log('no problems');
