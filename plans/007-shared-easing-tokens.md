# 007 — Turn the repeated easing curves into shared tokens

- **Status**: DONE (v158)
- **Commit**: 5a97c9d
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (swiss.css), about 30 mechanical replacements. Do AFTER plans 003, 004 and 005.

## Problem

`swiss.css` has about 28 hand-typed easing curves in three variants, no shared variables:

- `cubic-bezier(.2,.7,.2,1)` and `cubic-bezier(.2, .7, .2, 1)` (same curve, two spellings), for example lines 189, 197-199, 231, 298, 305, 322, 411, 427, 429, 638, 641, 688, 732, 739, 769, 790, 792, 812, 836
- `cubic-bezier(.16, 1, .3, 1)` (film window), lines 351-356, 574
- `cubic-bezier(.2, .9, .2, 1.05)` (streak banner entrance with overshoot), line 774

Tuning the feel of the site means editing dozens of places, and the two spellings hide that they are one curve.

## Target

Three tokens, defined once; every occurrence replaced by the token. **Curve values do not change**, so nothing should look different.

```css
/* target — add to the existing :root / html:root token block near the top of swiss.css */
:root {
  --ease-ui: cubic-bezier(.2, .7, .2, 1);       /* default UI entrance / hover curve in this app */
  --ease-pop: cubic-bezier(.16, 1, .3, 1);      /* film window and quick pops */
  --ease-spring: cubic-bezier(.2, .9, .2, 1.05);/* the banner's slight overshoot */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);   /* strong ease-out; used by plans 003 and 004 */
}
```

Then, for example: `transition: transform .3s var(--ease-ui)`, `animation: dmPop .2s var(--ease-pop) both`.

## Repo conventions to follow

- Tokens live as CSS variables in `swiss.css` (see `--accent`, `--text`, `--elev` used throughout; `html:root { --wv-head: ... }` at line 182 is the pattern for page-level variables).
- Plans 003 and 004 introduced the literal `cubic-bezier(0.23, 1, 0.32, 1)`; replace those with `var(--ease-out)` too.

## Steps

1. Find the root token block: `grep -n "^:root\|^html:root" web_live_build/swiss.css`. Add the four variables above to it (keep any existing variables).
2. Replace in this order, with search-and-replace on swiss.css only: `cubic-bezier(.2,.7,.2,1)` → `var(--ease-ui)`; `cubic-bezier(.2, .7, .2, 1)` → `var(--ease-ui)`; `cubic-bezier(.16, 1, .3, 1)` → `var(--ease-pop)`; `cubic-bezier(.2, .9, .2, 1.05)` → `var(--ease-spring)`; `cubic-bezier(0.23, 1, 0.32, 1)` → `var(--ease-out)`.
3. Variables inside `@keyframes` are not used for curves, so nothing in keyframe bodies changes. Confirm with `grep -n "cubic-bezier" web_live_build/swiss.css`: only the definitions in the token block should remain.
4. Bump `swiss.css?v=N` and `CACHE_NAME`.

## Boundaries

- Do NOT change any curve value or duration. This is a pure renaming.
- Do NOT touch `tailwind.css`, `index.html` inline styles or `games.js` in this plan.
- If a `cubic-bezier` appears inside a place where `var()` is not allowed (it is allowed in `transition` and `animation` shorthands, so this should not happen), STOP and report.

## Verification

- **Mechanical**: `grep -c "var(--ease" web_live_build/swiss.css` is about 28 and the only literal `cubic-bezier(` left are the four token definitions.
- **Feel check**: open Home, a film window, Taste Match and Tonight's pick: every entrance and hover feels exactly as before. Take a before/after screen recording at 10% speed of the film window opening if in doubt.
- **Done when**: no inline curve remains outside the token block and nothing looks different.
