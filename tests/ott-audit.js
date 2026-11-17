/*
 * WatchVibe "Where to watch" audit. Paste into the browser console on the running site.
 * It loads TMDB/JustWatch availability for every title and checks, for many regions, that:
 *   - every service shown for a region really appears in that region's TMDB data (no phantom services),
 *   - no service is dropped, none is duplicated, and stream vs rent/buy grouping is right,
 *   - every (service x region) produces a valid https link on an expected host.
 * Takes ~1-2 minutes. Result is returned and stored in window.__ottAudit.
 */
window.runOttAudit = async (regions = ['IN','US','GB','CA','AU','DE','JP','BR','AE','ZA','FR','ES','IT','MX','KR']) => {
  let i = 0; const lookupFailures = [];
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (i < mediaDatabase.length) { const m = mediaDatabase[i++]; if ((await getWatchProviders(m)) === null) lookupFailures.push(m.id); }
  }));
  const rep = { titles: mediaDatabase.length, regions: regions.length, combos: 0, lookupFailures: lookupFailures.length, phantom: 0, dropped: 0, groupErr: 0, dupEntries: 0, noneButHas: 0, perRegion: {}, services: 0, linkCombos: 0, linkBad: 0 };
  const names = new Set();
  for (const cc of regions) {
    const s = { stream: 0, rentBuyOnly: 0, none: 0, twoOrMore: 0 };
    for (const m of mediaDatabase) {
      const all = cachedWatchProviders(m); const raw = all && all[cc]; const av = availabilityFor(all, cc); rep.combos++;
      const rawNames = new Set(raw ? ['flatrate', 'ads', 'free', 'rent', 'buy'].flatMap(k => (raw[k] || []).map(p => p.name)) : []);
      rawNames.forEach(n => names.add(n));
      const ents = [...av.stream, ...av.rentbuy]; const seen = new Set(); const keys = new Set();
      ents.forEach(e => { e.raws.forEach(x => { seen.add(x); if (!rawNames.has(x)) rep.phantom++; }); if (keys.has(e.key)) rep.dupEntries++; keys.add(e.key); });
      rawNames.forEach(x => { if (!seen.has(x)) rep.dropped++; });
      if (!rawNames.size && av.has) rep.noneButHas++;
      av.stream.forEach(e => { if (![...e.kinds].some(k => ['stream', 'ads', 'free'].includes(k))) rep.groupErr++; });
      av.rentbuy.forEach(e => { if ([...e.kinds].some(k => ['stream', 'ads', 'free'].includes(k))) rep.groupErr++; });
      if (av.stream.length) s.stream++; else if (av.rentbuy.length) s.rentBuyOnly++; else s.none++;
      if (ents.length >= 2) s.twoOrMore++;
    }
    rep.perRegion[cc] = s;
  }
  const okHost = /^(www\.)?(netflix\.com|primevideo\.com|amazon\.(com|co\.uk|de|ca|com\.au|fr|es|it|co\.jp)|hotstar\.com|disneyplus\.com|tv\.apple\.com|play\.google\.com|youtube\.com|zee5\.com|sonyliv\.com|hulu\.com|max\.com|peacocktv\.com|paramountplus\.com|crunchyroll\.com|bbc\.co\.uk|tubitv\.com|justwatch\.com|themoviedb\.org)$/;
  for (const n of names) for (const cc of regions) {
    rep.linkCombos++;
    const u = buildProviderLink(n, 'Test: Title', false, cc, 'https://www.themoviedb.org/movie/1/watch?locale=' + cc);
    try { const x = new URL(u); if (x.protocol !== 'https:' || !okHost.test(x.host) || /undefined|null|NaN/.test(u)) rep.linkBad++; } catch (e) { rep.linkBad++; }
  }
  rep.services = names.size;
  window.__ottAudit = rep;
  return rep;
};
// Usage: await runOttAudit();
