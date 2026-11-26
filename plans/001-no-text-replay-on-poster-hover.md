# 001 — Stop the featured-film text replaying its entrance on every poster hover

- **Status**: DONE (v158)
- **Commit**: 5a97c9d
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 2 files (swiss.css, index.html), about 6 lines

## Problem

On the home poster wall, moving the mouse over a poster calls `wallShow(i)`, which calls `wallRefresh(false)`, which rewrites `#wvwNow` with `innerHTML`. Every freshly inserted child of `.wvw-now` then plays the entrance animation again (0.5 s rise, the 5th child delayed 0.22 s). Sweeping the pointer along a row of posters, which people do dozens of times a day, restarts the text over and over and it never settles. The entrance is meant for the first paint only.

```js
// web_live_build/index.html:5499-5510 — current
function wallRefresh(full) {
  const now = document.getElementById('wvwNow'); if (!now) return;
  now.innerHTML = wallNowHtml();
  if (full) { /* ... */ }
  wallTint();
}
function wallShow(i) {
  if (i === WALL.i || i < 0 || i >= WALL.list.length) return;
  WALL.i = i;
  document.querySelectorAll('#wvwSnap .wvw-pc').forEach((c, k) => c.classList.toggle('on', k === i));
  wallRefresh(false);
}
```

```css
/* web_live_build/swiss.css:197-198 — current */
.wvw-now > * { animation: wvRise .5s cubic-bezier(.2,.7,.2,1) both; }
.wvw-now > :nth-child(2) { animation-delay: .04s; } .wvw-now > :nth-child(3) { animation-delay: .1s; } .wvw-now > :nth-child(4) { animation-delay: .16s; } .wvw-now > :nth-child(5) { animation-delay: .22s; }
```

## Target

Swapping the featured film by hovering, focusing or scrolling the poster row swaps the text with no entrance animation. The first render of the wall, and a full refresh (mood or filter change, `wallRefresh(true)`), keep the rise.

```css
/* target — add directly after the nth-child delay rules (inside the same prefers-reduced-motion: no-preference block) */
.wvw-now.is-swap > * { animation: none; }
```

```js
// target
function wallRefresh(full) {
  const now = document.getElementById('wvwNow'); if (!now) return;
  now.classList.toggle('is-swap', !full);   // a hover swap changes the text without replaying the entrance
  now.innerHTML = wallNowHtml();
  ...
}
```

## Repo conventions to follow

- Motion lives in `web_live_build/swiss.css` inside `@media (prefers-reduced-motion: no-preference)` blocks; JS only toggles classes.
- Exemplar of the same idea already in the repo: `.wv-calm #mainViewport .wvw-now > * { animation-duration: 0s !important; }` at `swiss.css:598`.

## Steps

1. In `web_live_build/swiss.css`, after line 198 (the `:nth-child` delay rule) and still inside the same `@media (prefers-reduced-motion: no-preference)` block, add `.wvw-now.is-swap > * { animation: none; }`.
2. In `web_live_build/index.html`, inside `wallRefresh(full)`, add the line `now.classList.toggle('is-swap', !full);` immediately after the `if (!now) return;` guard and before `now.innerHTML = ...`.
3. Check every other caller: `grep -n "wallRefresh(" web_live_build/index.html`. Callers that pass `true` (or a truthy value) keep the entrance; callers that pass `false`/nothing (hover, focus, scroll, watchlist toggle) now skip it. Do not change any caller.
4. Bump the cache-bust number for swiss.css in `index.html` (`swiss.css?v=N`, currently 42, make it 43) and the `CACHE_NAME` in `web_live_build/sw.js`.

## Boundaries

- Do NOT touch the poster tilt, `.wvw-pc` entrance, or the mood tint.
- Do NOT change markup produced by `wallNowHtml()`.
- Do NOT add dependencies.
- If `wallRefresh` no longer matches the excerpt (drift since commit 5a97c9d), STOP and report.

## Verification

- **Mechanical**: syntax check of the inline scripts (`node` script that runs `new Function()` on each inline script of index.html) passes; `node --check web_live_build/games.js`.
- **Feel check**: run the local server (127.0.0.1:8098), open Home on a desktop width, then:
  - Hover quickly across 6 posters: the title and facts change instantly, with no rising or flicker.
  - Reload the page: the title and facts still rise in on first load.
  - Click a mood chip: the text still rises (full refresh).
  - DevTools Animations panel at 10% speed: no `wvRise` animations start while hovering posters.
  - Rendering panel, emulate reduced motion: nothing moves in either case.
- **Done when**: hovering posters starts zero `wvRise` animations, first load and mood change still play it.
