/*
 * WatchVibe UI regression checks. Paste into the browser console on the running site.
 * Run once per viewport width (phone 375, tablet 768, desktop 1440) for the clipping check.
 */

// 1) "More like this" must always land at the top of the details window.
window.testScrollToTop = async (chains = 30) => {
  window.startTrailerPreview = async () => {}; // scrolling only, no trailer iframes
  const sc = () => document.getElementById('detailScroll');
  let atTop = 0; const failures = [];
  await openDetails('interstellar-157336'); await new Promise(r => setTimeout(r, 200));
  for (let i = 0; i < chains; i++) {
    sc().scrollTop = sc().scrollHeight; await new Promise(r => setTimeout(r, 50));
    const before = Math.round(sc().scrollTop);
    const cards = [...document.querySelectorAll('#detailBody section')].find(s => /More like this/.test(s.innerText))?.querySelectorAll('button[onclick^="openDetails"]');
    if (!cards || !cards.length) { failures.push({ i, why: 'no cards' }); break; }
    cards[i % cards.length].click(); await new Promise(r => setTimeout(r, 220));
    const after = Math.round(sc().scrollTop);
    if (after === 0) atTop++; else failures.push({ i, before, after });
  }
  closeDetails();
  return { chains, atTop, failures };
};

// 2) No title may be clipped in the details window or on cards, at the current viewport width.
window.testNoClipping = async () => {
  window.startTrailerPreview = async () => {};
  const modal = document.getElementById('detailModal'); modal.classList.remove('hidden');
  const holder = document.getElementById('modalContent'); const sc = document.getElementById('detailScroll');
  const I = { heroTitleOut: 0, heroMetaOut: 0, controlsOut: 0, overlap: 0, hOverflow: 0, textOverflow: 0 };
  for (const m of mediaDatabase) {
    delete holder.dataset.itemId; renderMovieDetailsModal(m);
    const vw = document.getElementById('previewVolumeWrap'); vw.classList.remove('hidden'); vw.classList.add('flex'); document.getElementById('previewReplayBtn').classList.remove('hidden');
    const hr = holder.firstElementChild.getBoundingClientRect(); const sr = sc.getBoundingClientRect();
    const tt = document.getElementById('detailTitle').getBoundingClientRect(); const mt = document.getElementById('detailMeta').getBoundingClientRect(); const cr = document.getElementById('previewControls').getBoundingClientRect();
    if (tt.top < hr.top - 0.5 || tt.bottom > hr.bottom + 0.5) I.heroTitleOut++;
    if (mt.top < hr.top - 0.5 || mt.bottom > hr.bottom + 0.5) I.heroMetaOut++;
    if (cr.right > sr.right + 1 || cr.left < sr.left - 1 || cr.bottom > hr.bottom + 0.5) I.controlsOut++;
    if (tt.right > cr.left + 1 && tt.bottom > cr.top && tt.top < cr.bottom) I.overlap++;
    if (sc.scrollWidth > sc.clientWidth + 1) I.hOverflow++;
    for (const el of holder.querySelectorAll('h2,p,dd,dt,a,button,span,div')) {
      if (el.children.length > 2) continue;
      if (getComputedStyle(el).overflow === 'visible' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && el.innerText && el.innerText.trim()) { I.textOverflow++; break; }
    }
    vw.classList.add('hidden'); vw.classList.remove('flex');
  }
  modal.classList.add('hidden'); delete holder.dataset.itemId;
  // poster / library cards at typical widths: full title visible and inside the frame
  let cardIssues = 0;
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-9999px;top:0;opacity:0'; document.body.appendChild(host);
  for (const w of [150, 170, 180, 260]) { host.style.width = w + 'px';
    for (const m of mediaDatabase) {
      host.innerHTML = posterCard(m, { wide: true }) + libraryCard(m, 'want');
      const titles = [...host.querySelectorAll('div')].filter(d => d.children.length === 0 && d.textContent.trim() === m.title.trim());
      if (titles.length < 2) cardIssues++;
      for (const el of host.querySelectorAll('div,span,button')) { if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'visible' && el.clientWidth > 0) { cardIssues++; break; } }
    } }
  host.remove();
  return { viewportWidth: innerWidth, titles: mediaDatabase.length, ...I, cardIssues };
};

// Usage: await testScrollToTop();  await testNoClipping();
