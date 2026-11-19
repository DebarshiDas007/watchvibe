// Hover card: on a computer, pausing the mouse on a poster opens a larger, fixed-size card over it with a picture,
// the title, Play / add to watchlist / like / more-info buttons, the main facts and the mood tags (like Netflix).
// Every card has exactly the same size and layout. Touch screens have no hover, so nothing changes there.
// Uses globals from index.html: mediaDatabase, userWatchlistIds, VIBES, EXTRAS, extrasKeyOf, certFor, selectedCountry,
// openDetails, toggleWatchlist, ps, esc.
(function () {
  'use strict';
  if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const PW = 340, PH = 326, DELAY = 320, LEAVE = 140;
  let pop = null, cur = null, showT = 0, hideT = 0;

  const safeUrl = u => /^https:\/\/image\.tmdb\.org\//.test(String(u || '')) ? String(u) : '';
  const itemOf = btn => { const m = /^openDetails\('([A-Za-z0-9_.:-]{1,100})'\)$/.exec(btn.getAttribute('onclick') || ''); return m ? mediaDatabase.find(x => x.id === m[1]) : null; };
  const listed = id => { try { return (userWatchlistIds || []).includes(id); } catch (e) { return false; } };

  function fill(it) {
    const tags = (it.genres || []).filter(g => !/^(Trending|Cinema|Series|Movie|Stand-?Up)$/i.test(g)).slice(0, 2);
    try { const v = VIBES[it.dominantVibe]; if (v) tags.push(v.label); } catch (e) {}
    let cert = '';
    try { cert = certFor(EXTRAS.cache.get(extrasKeyOf(it)), selectedCountry); if (cert && typeof cert === 'object') cert = cert.label || cert.text || cert.cert || ''; } catch (e) { cert = ''; }
    const kind = it.type === 'Series' ? 'Series' : it.type === 'Stand-Up' ? 'Stand-up' : 'Film';
    const img = safeUrl(it.backdrop).replace('/w1280/', '/w780/') || safeUrl(it.poster);
    const on = listed(it.id);
    pop.dataset.id = it.id;
    pop.innerHTML =
      `<div class="hc-media" data-a="open">${img ? `<img alt="" src="${esc(img)}">` : ''}<div class="hc-name">${esc(it.title)}</div></div>` +
      `<div class="hc-body"><div class="hc-actions">` +
      `<button type="button" class="hc-b play" data-a="open" aria-label="Open ${esc(it.title)}"><i class="fa-solid fa-play"></i></button>` +
      `<button type="button" class="hc-b${on ? ' on' : ''}" data-a="list" aria-label="${on ? 'Remove from' : 'Add to'} watchlist"><i class="fa-solid ${on ? 'fa-check' : 'fa-plus'}"></i></button>` +
      `<span class="sp"></span>` +
      `<button type="button" class="hc-b" data-a="open" aria-label="More info"><i class="fa-solid fa-chevron-down"></i></button></div>` +
      `<div class="hc-meta"><span>${kind}</span>${cert ? `<span class="cert">${esc(cert)}</span>` : ''}${it.year ? `<span>${esc(it.year)}</span>` : ''}${it.duration ? `<span>${esc(it.duration)}</span>` : ''}${it.rating ? `<span class="star">&#9733; ${esc(it.rating)}</span>` : ''}</div>` +
      `<div class="hc-tags">${tags.map(esc).join('<i></i>')}</div></div>`;
  }
  function place(card) {
    const poster = card.querySelector('div[class*="aspect-[2/3]"]') || card, r = poster.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const left = Math.max(10, Math.min(innerWidth - PW - 10, cx - PW / 2));
    const top = Math.max(72, Math.min(innerHeight - PH - 10, cy - PH / 2));
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.style.transformOrigin = (cx - left) + 'px ' + (cy - top) + 'px';   // always grows out of its own poster
  }
  function show(card) {
    if (!card.isConnected || document.querySelector('#detailModal:not(.hidden)')) return;
    const it = itemOf(card); if (!it) return;
    cur = card; fill(it);
    pop.classList.remove('on'); pop.style.display = 'block'; pop.style.visibility = 'hidden';
    place(card); pop.style.visibility = ''; void pop.offsetWidth; pop.classList.add('on');
  }
  function hide() { clearTimeout(showT); if (!pop) return; pop.classList.remove('on'); pop.style.display = 'none'; cur = null; }

  function init() {
    if (pop) return;
    pop = document.createElement('div'); pop.id = 'hoverCard'; pop.setAttribute('aria-hidden', 'true');   // a mouse-only extra: keyboard and screen-reader users open the title from the poster itself
    document.body.appendChild(pop);
    document.addEventListener('mouseover', e => {
      const t = e.target; if (!t || !t.closest) return;
      if (t.closest('#hoverCard')) { clearTimeout(hideT); return; }
      const card = t.closest('button.group');
      if (cur && !cur.isConnected) hide();
      if (card && card.querySelector('div[class*="aspect-[2/3]"]') && !document.querySelector('#detailModal:not(.hidden)')) {
        clearTimeout(hideT);
        if (card !== cur) { clearTimeout(showT); showT = setTimeout(() => show(card), DELAY); }
      } else { clearTimeout(showT); clearTimeout(hideT); hideT = setTimeout(hide, LEAVE); }
    }, true);
    window.addEventListener('scroll', () => { if (cur) hide(); }, { passive: true, capture: true });
    document.documentElement.addEventListener('mouseleave', hide);
    window.addEventListener('blur', hide);
    document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && pop && pop.contains(t)) t.style.display = 'none'; }, true);   // a missing picture leaves the dark box, not a broken icon
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    pop.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const id = pop.dataset.id, a = b.dataset.a;
      if (a === 'open') { hide(); openDetails(id); }
      else if (a === 'list') { toggleWatchlist(id); const on = listed(id); b.classList.toggle('on', on); b.setAttribute('aria-label', (on ? 'Remove from' : 'Add to') + ' watchlist'); b.innerHTML = `<i class="fa-solid ${on ? 'fa-check' : 'fa-plus'}"></i>`; }
    });
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
