# 005 — Shorten the star-card photo zoom on hover

- **Status**: DONE (v158)
- **Commit**: 5a97c9d
- **Severity**: LOW
- **Category**: Easing & duration
- **Estimated scope**: 1 file (swiss.css), 1 line

## Problem

On the "Trending stars" row, hovering a card zooms the photo with a 0.5 s transition. Hover effects are hit tens of times a day and UI motion should stay under 300 ms, so the zoom lags behind the pointer. The card lift next to it (`transform .3s`, line 638) is also at the upper edge.

```css
/* web_live_build/swiss.css:641 — current */
.wvs-ph img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 16%; transition: transform .5s cubic-bezier(.2, .7, .2, 1); }
```

## Target

```css
/* target */
.wvs-ph img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 16%; transition: transform .25s cubic-bezier(.2, .7, .2, 1); }
```

Same curve, half the time. Leave `.wvs-card:hover img { transform: scale(1.04); }` as is.

## Repo conventions to follow

- Hover transitions elsewhere in the file run at .2 to .3 s (for example `swiss.css:200`, `.28s`).

## Steps

1. Change `.5s` to `.25s` in the `.wvs-ph img` rule (line 641).
2. Bump `swiss.css?v=N` and `CACHE_NAME`.

## Boundaries

- Do NOT change the zoom amount or the card lift.
- If the line moved, STOP and report.

## Verification

- **Mechanical**: page loads styled.
- **Feel check**: hover across the stars row: the photo reaches its zoom as the pointer arrives, with no trailing drift. Slow-motion (10%): no stutter when moving between cards.
- **Done when**: zoom completes in 250 ms.
