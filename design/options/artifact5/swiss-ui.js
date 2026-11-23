/* Helpers shared by the Swiss variations. */
window.SW = (() => {
  const { esc } = WV;
  const card = (f, o = {}) => `<a class="card" href="#film-${f.id}"${o.tilt ? ' data-tilt' : ''}><div class="ph" style="background-image:url(${o.wide ? f.back() : f.poster()})"></div><div class="t">${esc(f.title)}</div><div class="s">★ ${f.rating} · ${f.year}</div></a>`;
  const header = (r, o = {}) => `<header class="sw"><div class="grid"><a class="logo" href="#home">Watch<i>Vibe</i></a><nav class="m mo"><a class="${r === 'home' ? 'on' : ''}" href="#home">${o.home || 'Index'}</a><a class="${r === 'films' ? 'on' : ''}" href="#films">Films</a><a class="${r === 'games' ? 'on' : ''}" href="#games">Games</a><a class="${r === 'watchlist' ? 'on' : ''}" href="#watchlist">Watchlist${WVApp.wlCount() ? ' (' + WVApp.wlCount() + ')' : ''}</a></nav><div class="rt2 mo"><button type="button" data-search>Search /</button><button type="button" class="thm" data-theme-toggle aria-label="Switch between light and dark"><span data-theme-label>Dark</span></button></div></div></header>`;
  const footer = () => `<footer class="sw"><div class="grid mo"><div class="a">WatchVibe — find what to watch by feeling</div><div class="b">Privacy · Terms · Film data from TMDB</div></div></footer><nav class="mnav"><a href="#home">Index</a><a href="#films">Films</a><a href="#games">Games</a><a href="#watchlist">Saved</a></nav>`;
  const shell = (inner, r, o) => header(r, o) + inner + footer();
  const stripOf = (list, o) => `<div class="strip">${list.map(f => card(f, o)).join('')}</div>`;
  const indexRows = (list, o = {}) => `<div class="index">${list.map((f, i) => `<a href="#film-${f.id}" data-prev="${f.poster()}" data-kbrow><span class="n">${String(i + 1).padStart(2, '0')}</span><div class="im" style="background-image:url(${f.poster()})"></div><b>${esc(f.title)}</b><span class="g">${esc(f.genre.split(' · ')[0])} · ${f.year}</span><span class="r">★ ${f.rating}</span></a>`).join('')}</div>`;
  return { card, header, footer, shell, stripOf, indexRows };
})();
