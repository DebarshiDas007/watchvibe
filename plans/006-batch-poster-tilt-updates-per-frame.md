# 006 — Batch the poster-tilt updates to once per frame

- **Status**: DONE (v158)
- **Commit**: 5a97c9d
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 file (index.html), about 8 lines

## Problem

The poster tilt writes four CSS variables on every `pointermove` (mouse devices only, correctly gated). Pointer events can fire faster than the screen refresh, so style work can happen several times per frame while the pointer moves over a poster.

```js
// web_live_build/index.html:5534-5544 — current
(function () {
  const fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)'), calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('pointermove', e => {
    if (!fine || !fine.matches || (calm && calm.matches) || e.pointerType !== 'mouse') return;
    const c = e.target.closest && e.target.closest('.wvw-pc'); if (!c) return;
    const ph = c.querySelector('.wvw-ph'), r = ph.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    ph.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg'); ph.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg');
    ph.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); ph.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  }, { passive: true });
  document.addEventListener('pointerout', ...);
})();
```

## Target

Remember the latest pointer position and apply it once per animation frame. Visual result identical.

```js
// target
(function () {
  const fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)'), calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  let last = null, raf = 0;
  const apply = () => {
    raf = 0; if (!last) return;
    const { c, cx, cy } = last, ph = c.querySelector('.wvw-ph'); if (!ph) return;
    const r = ph.getBoundingClientRect(), x = (cx - r.left) / r.width, y = (cy - r.top) / r.height;
    ph.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg'); ph.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg');
    ph.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); ph.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  };
  document.addEventListener('pointermove', e => {
    if (!fine || !fine.matches || (calm && calm.matches) || e.pointerType !== 'mouse') return;
    const c = e.target.closest && e.target.closest('.wvw-pc'); if (!c) return;
    last = { c, cx: e.clientX, cy: e.clientY };
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  // pointerout handler unchanged, but also cancel a pending frame: add `last = null;` as its first statement inside the handler
})();
```

## Repo conventions to follow

- Exemplar of rAF batching in this file: the scroll handler at `index.html:5546-5550` (`if (s._t) return; s._t = requestAnimationFrame(...)`).

## Steps

1. Replace the `pointermove` handler as in Target.
2. In the existing `pointerout` handler, add `last = null;` before it removes `--rx` / `--ry`, so a pending frame cannot re-tilt a poster the pointer already left.
3. Do not change the CSS in swiss.css (line 200 stays).
4. Bump `CACHE_NAME` in sw.js.

## Boundaries

- Do NOT change tilt angles (8 and 10 degrees) or the light spot.
- Do NOT remove the reduced-motion or mouse-only gates.
- This is a micro-optimisation: if the result feels different, revert rather than tune.

## Verification

- **Mechanical**: syntax check of the inline scripts passes.
- **Feel check**: on desktop, move the mouse slowly and quickly over posters: tilt follows with no added lag and no stuck tilt after leaving a poster. DevTools Performance panel: fewer "Recalculate style" entries per frame during a sweep than before.
- **Done when**: tilt looks identical, and at most one variable update runs per frame.
