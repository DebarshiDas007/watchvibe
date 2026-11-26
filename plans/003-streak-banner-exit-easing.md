# 003 — Give the streak banner a fast exit curve

- **Status**: DONE (v158)
- **Commit**: 5a97c9d
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file (swiss.css), 1 line

## Problem

The streak banner leaves with `ease-in`, which starts slowly: the banner sits still for the first part of the exit, the exact moment the viewer is watching.

```css
/* web_live_build/swiss.css:775 — current */
.stk-banner.is-out { animation: stkOut .35s ease-in forwards; }
```

## Target

Strong ease-out, shorter:

```css
/* target */
.stk-banner.is-out { animation: stkOut .25s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
```

`@keyframes stkOut` (line 777) is unchanged. The `prefers-reduced-motion: reduce` rule at line 784 already removes the banner's motion.

## Repo conventions to follow

- Curves in `swiss.css` are written inline; if plan 007 (curve tokens) has already been done, write `var(--ease-out)` instead of the literal cubic-bezier.
- Exemplar: the entrance on line 774 (`stkIn .5s cubic-bezier(.2, .9, .2, 1.05)`) uses a custom curve, not a keyword.

## Steps

1. Edit line 775 exactly as in Target.
2. Bump `swiss.css?v=N` in index.html and `CACHE_NAME` in sw.js.

## Boundaries

- Do NOT change `stkIn`, the banner markup or the JS that adds `is-out`.
- If line 775 no longer matches, STOP and report.

## Verification

- **Mechanical**: page loads styled.
- **Feel check**: trigger the banner (earn or bump a streak on the local server, or add the class manually in DevTools: `document.querySelector('.stk-banner').classList.add('is-out')`):
  - The banner starts moving up at once and finishes quickly, with no slow start.
  - Animations panel at 10%: the curve starts steep, not flat.
  - Reduced motion: banner appears and disappears without sliding.
- **Done when**: the exit has no slow start and takes 250 ms.
