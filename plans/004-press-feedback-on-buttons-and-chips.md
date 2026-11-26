# 004 — Add press feedback to buttons and chips

- **Status**: DONE (v158)
- **Commit**: 5a97c9d
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file (swiss.css), about 10 lines

## Problem

`swiss.css` has no `:active` rule for any button or chip (the only `:active` is `.pe-stage`, line 712). Taps and clicks on `.wv-btn`, `.wv-chip`, `.pk-btn` and `.dmx-chip` give no response until the action itself happens, so the controls feel dead, especially on phones. Some Tailwind buttons in `index.html` already use `active:scale-*`, so the app is inconsistent.

```css
/* web_live_build/swiss.css:51 — current */
.wv-btn { border-radius: 0; height: 46px; font-weight: 600; }

/* web_live_build/swiss.css:189 — current */
.wv-chip { ...; transition: background-size .32s cubic-bezier(.2,.7,.2,1), color .32s, border-color .2s; }

/* web_live_build/swiss.css:746 — current */
.pk-btn { ...; transition: background .2s, color .2s; }

/* web_live_build/swiss.css:611 — current */
.dmx-chip { ...; transition: background .2s, color .2s, border-color .2s; }
```

## Target

A subtle press scale of 0.97 on `:active`, released at 160 ms with a strong ease-out. Add `transform` to each element's existing transition list (do not replace the list: that would drop the existing hover transitions).

```css
/* target — append to each existing transition list */
.wv-chip  { transition: background-size .32s cubic-bezier(.2,.7,.2,1), color .32s, border-color .2s, transform .16s cubic-bezier(0.23, 1, 0.32, 1); }
.pk-btn   { transition: background .2s, color .2s, transform .16s cubic-bezier(0.23, 1, 0.32, 1); }
.dmx-chip { transition: background .2s, color .2s, border-color .2s, transform .16s cubic-bezier(0.23, 1, 0.32, 1); }
/* .wv-btn: find where its transition is defined (grep below) and append the same transform term; if it has none, add one */

.wv-chip:active, .pk-btn:active, .dmx-chip:active, .wv-btn:active { transform: scale(0.97); }
```

## Repo conventions to follow

- Keep it within 0.95 to 0.98 (here 0.97).
- Do NOT apply to `.wvw-pc` (poster cards): their entrance animation uses `fill-mode: both` and holds `transform: none`, which would override a transform set by `:active`; the posters also tilt.
- Exemplar of a transform transition on a card: `swiss.css:638`.

## Steps

1. Find where `.wv-btn` gets its transition: `grep -n "wv-btn" web_live_build/swiss.css web_live_build/tailwind.css | head -20`. Append `, transform .16s cubic-bezier(0.23, 1, 0.32, 1)` to that transition list, or add `transition: transform .16s cubic-bezier(0.23, 1, 0.32, 1)` to the `.wv-btn` rule (line 51) if none exists elsewhere.
2. Append the same `transform` term to the transition lists of `.wv-chip` (line 189), `.pk-btn` (746) and `.dmx-chip` (611) exactly as in Target.
3. Add the single `:active` rule from Target at the end of the "v151" block area (end of swiss.css).
4. Do not duplicate: buttons that already use Tailwind `active:scale-*` in index.html keep it.
5. Bump `swiss.css?v=N` and `CACHE_NAME`.

## Boundaries

- Do NOT change hover rules, colours or sizes.
- Do NOT add press feedback to `.wvw-pc`.
- If a transition list differs from the excerpt, STOP and report.

## Verification

- **Mechanical**: page loads styled; `npm run build:css` is NOT needed (no Tailwind classes added).
- **Feel check**: mouse-down on a mood chip, a "Pick for me tonight" button and a Draw/Game button:
  - Each shrinks slightly (about 3%) while held and springs back on release; the hover fill on chips still sweeps in at its old speed.
  - Spamming clicks never leaves a control scaled down.
  - Reduced motion: still fine (a 3% scale is not large movement), but confirm nothing else changed.
- **Done when**: all four control types respond to press with `scale(0.97)` and release in 160 ms.
