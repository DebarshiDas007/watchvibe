/* Poster wall component shared by the hybrid designs: snap carousel with numerals, arrows, progress bar and an "active poster" event. */
window.Wall = (() => {
  const { esc } = WV;
  const pc = (f, i) => `<a class="pc" href="#film-${f.id}" data-fid="${f.id}" data-tilt><span class="nn">${String(i + 1).padStart(2, '0')}</span><div class="ph" style="background-image:url(${f.poster()})"></div><div class="t">${esc(f.title)}</div><div class="s">★ ${f.rating} · ${f.year}</div></a>`;
  const cards = list => list.map((f, i) => pc(f, i)).join('');
  const row = (id, list, o = {}) => `<div class="wl${o.cls ? ' ' + o.cls : ''}" data-wall="${id}"><div class="snap" tabindex="0" aria-label="${esc(o.label || 'Poster wall')}">${cards(list)}</div><div class="wl-foot"><div class="prog"><i></i></div><div class="arrows"><button type="button" data-wall-go="-1" aria-label="Previous posters">←</button><button type="button" data-wall-go="1" aria-label="Next posters">→</button></div></div></div>`;
  document.addEventListener('click', e => { const b = e.target.closest('[data-wall-go]'); if (!b) return; const s = b.closest('.wl').querySelector('.snap'); s.scrollBy({ left: +b.dataset.wallGo * Math.min(s.clientWidth * .8, 640), behavior: 'smooth' }); });
  function sync(s) {
    const w = s.closest('.wl'); if (!w) return;
    const p = w.querySelector('.prog i'), k = s.scrollLeft / Math.max(1, s.scrollWidth - s.clientWidth);
    if (p) p.style.width = (10 + k * 90) + '%';
    const cs = [...s.querySelectorAll('.pc')], left = s.getBoundingClientRect().left; let a = cs[0];
    for (const c of cs) { if (c.getBoundingClientRect().left >= left - 24) { a = c; break; } }
    if (a && w.dataset.active !== a.dataset.fid) { w.dataset.active = a.dataset.fid; document.dispatchEvent(new CustomEvent('wallactive', { detail: { wall: w.dataset.wall, id: +a.dataset.fid } })); }
  }
  document.addEventListener('scroll', e => { const s = e.target; if (s && s.classList && s.classList.contains('snap')) sync(s); }, true);
  document.addEventListener('keydown', e => { const s = document.activeElement; if (!s || !s.classList || !s.classList.contains('snap')) return; if (e.key === 'ArrowRight') { e.preventDefault(); s.scrollBy({ left: 300, behavior: 'smooth' }); } if (e.key === 'ArrowLeft') { e.preventDefault(); s.scrollBy({ left: -300, behavior: 'smooth' }); } });
  const bind = () => document.querySelectorAll('.snap').forEach(sync);
  return { pc, cards, row, bind, sync };
})();
