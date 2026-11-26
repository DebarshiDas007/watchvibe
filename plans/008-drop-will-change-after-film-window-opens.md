# 008 — Stop holding `will-change` on the film window after it opens

- **Status**: DONE (v158)
- **Commit**: 5a97c9d
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 file (swiss.css), 1 line

## Problem

The film window's scroll area has `will-change: transform, opacity` set inside the `.dm-enter` rule, and that class stays on `#detailModal` while the window is open. The browser therefore keeps the whole scrollable window (a large, tall layer) promoted to its own layer for as long as the user reads and scrolls, which costs memory and can blur text on some devices. The animation is only 0.2 s long.

```css
/* web_live_build/swiss.css:351 — current */
#detailModal.dm-enter #detailScroll { animation: dmPop .2s cubic-bezier(.16, 1, .3, 1) both; will-change: transform, opacity; }
```

## Target

The animation already promotes the element to a compositor layer while it runs, so the hint is not needed:

```css
/* target */
#detailModal.dm-enter #detailScroll { animation: dmPop .2s cubic-bezier(.16, 1, .3, 1) both; }
```

(If plan 007 has been applied, the curve is `var(--ease-pop)`; keep that.)

## Repo conventions to follow

- Other `will-change` uses in swiss.css and index.html are on short-lived animated elements only (for example `.pk-track`, `.rs-burst i`); this one is the only one that stays on a large container.

## Steps

1. Delete ` will-change: transform, opacity;` from line 351.
2. Bump `swiss.css?v=N` and `CACHE_NAME`.

## Boundaries

- Do NOT touch the other `dm-enter` rules (lines 350, 352-356).
- If the line differs, STOP and report.

## Verification

- **Mechanical**: page loads styled.
- **Feel check**: open a film window repeatedly: the 0.2 s pop looks the same, with no first-frame stutter. Scroll the open window: text is crisp. DevTools Layers panel: `#detailScroll` is not a permanent composited layer once the animation ends.
- **Done when**: no `will-change` remains on `#detailScroll` and the opening animation looks unchanged.
