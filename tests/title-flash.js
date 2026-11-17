/*
 * WatchVibe title-look test. Paste into the browser console on the running site, then:  await testTitleFlash()
 *
 * For a sample of titles it opens the details window and records every change of the title area through a MutationObserver
 * (works even when the pane is in the background, unlike requestAnimationFrame or fast timers).
 * A "flash" is the plain title being visible first and then being replaced by the official logo (the bug this guards against).
 * Titles with no official artwork must end on the genre fallback look (inline text-shadow) and must never be left invisible.
 * cold = nothing cached (first visit); warm = after pointing at the card (hover/touch prefetch); repeat = second open.
 */
window.testTitleFlash = async (n = 24) => {
  window.startTrailerPreview = async () => {};
  const w = ms => new Promise(r => setTimeout(r, ms));
  const pool = mediaDatabase.filter(m => tmdbRef(m));
  const pick = []; const used = new Set();
  while (pick.length < n && used.size < pool.length) { const i = Math.floor(Math.random() * pool.length); if (!used.has(i)) { used.add(i); pick.push(pool[i]); } }
  const watch = async (m, ms = 3000) => {
    const t0 = performance.now(); let sawText = false, sawLogo = false, flash = false, logoAt = null, textAt = null;
    const state = () => {
      const h = document.getElementById('detailTitle'); if (!h) return;
      const img = h.querySelector('img'); const span = h.querySelector('[data-t]');
      const textVisible = span && !span.classList.contains('sr-only') && !span.classList.contains('opacity-0');
      if (img && img.getAttribute('src')) { if (!sawLogo) logoAt = Math.round(performance.now() - t0); sawLogo = true; if (sawText) flash = true; }
      else if (textVisible) { if (!sawText) textAt = Math.round(performance.now() - t0); sawText = true; }
    };
    const mo = new MutationObserver(state);
    mo.observe(document.getElementById('modalContent'), { subtree: true, childList: true, attributes: true });
    await openDetails(m.id); state();
    await w(ms); state(); mo.disconnect();
    const h = document.getElementById('detailTitle'); const span = h && h.querySelector('[data-t]');
    const finalVisible = !!(h && ((h.querySelector('img') && h.querySelector('img').getAttribute('src')) || (span && !span.classList.contains('opacity-0') && !span.classList.contains('sr-only'))));
    const styled = !sawLogo && span ? (span.getAttribute('style') || '').includes('text-shadow') : null;
    closeDetails(); await w(150);
    return { title: m.title, sawLogo, sawText, flash, logoAt, textAt, finalVisible, fallbackStyled: styled };
  };
  const out = { cold: [], warm: [], repeat: [] };
  try { localStorage.removeItem('watchvibe_extras_v1'); } catch (e) {}
  EXTRAS.cache.clear(); EXTRAS.warm.clear();
  for (const m of pick) out.cold.push(await watch(m));
  EXTRAS.cache.clear(); EXTRAS.warm.clear();
  for (const m of pick) { warmTitle(m); await w(1500); out.warm.push(await watch(m)); }
  for (const m of pick) out.repeat.push(await watch(m, 1500));
  const sum = a => ({ n: a.length, logo: a.filter(x => x.sawLogo).length, fallback: a.filter(x => !x.sawLogo).length, fallbackStyled: a.filter(x => x.fallbackStyled).length, flashes: a.filter(x => x.flash).length, invisibleAtEnd: a.filter(x => !x.finalVisible).length, textShownBeforeLogo: a.filter(x => x.sawLogo && x.sawText).length, medianLogoMs: (() => { const v = a.map(x => x.logoAt).filter(x => x != null).sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : null; })() });
  return { cold: sum(out.cold), warm: sum(out.warm), repeat: sum(out.repeat), detail: out };
};
