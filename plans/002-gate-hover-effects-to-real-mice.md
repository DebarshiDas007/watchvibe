# 002 — Limit hover effects to devices that really hover

- **Status**: DONE (v158)
- **Commit**: 5a97c9d
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (swiss.css), about 8 lines

## Problem

Touch screens fire `:hover` on tap and keep it until the next tap elsewhere. Three hover effects in `swiss.css` are not limited to mouse devices, so on phones a chip stays filled, or a button stays inverted, after it is tapped. Only the poster tilt (gated in JS) and the stars row (`@media (hover: none)` at line 650) are protected.

```css
/* web_live_build/swiss.css:189-191 — current */
.wv-chip { background-image: linear-gradient(var(--text), var(--text)); background-repeat: no-repeat; background-size: 0% 100%; transition: background-size .32s cubic-bezier(.2,.7,.2,1), color .32s, border-color .2s; }
.wv-chip:hover { background-color: transparent; background-size: 100% 100%; color: var(--bg); }
html .wv-chip.is-on { background-size: 100% 100%; }

/* web_live_build/swiss.css:614-615 — current */
.dmx-chip:hover { background: #fff; color: #000; border-color: #fff; }
.dmx-chip:hover em { color: rgba(0,0,0,.6); }

/* web_live_build/swiss.css:747-749 — current */
.pk-btn:hover { background: var(--text); color: var(--bg); }
.pk-btn.pk-primary { background: var(--text); color: var(--bg); }
.pk-btn.pk-primary:hover { background: transparent; color: var(--text); }
```

## Target

The same hover rules, applied only when the device can hover with a precise pointer:

```css
@media (hover: hover) and (pointer: fine) {
  .wv-chip:hover { background-color: transparent; background-size: 100% 100%; color: var(--bg); }
}
@media (hover: hover) and (pointer: fine) {
  .dmx-chip:hover { background: #fff; color: #000; border-color: #fff; }
  .dmx-chip:hover em { color: rgba(0,0,0,.6); }
}
@media (hover: hover) and (pointer: fine) {
  .pk-btn:hover { background: var(--text); color: var(--bg); }
  .pk-btn.pk-primary:hover { background: transparent; color: var(--text); }
}
```

Rule values and declarations stay identical; only the wrapping changes.

## Repo conventions to follow

- Exemplar: `swiss.css:136` and `swiss.css:650` already use hover media queries (`@media (hover: none)`); this plan uses the positive form `(hover: hover) and (pointer: fine)`, which is the one named in the animation audit playbook.
- Keep `html .wv-chip.is-on` (selected state) unwrapped: selection is not hover.

## Steps

1. `swiss.css:190`: cut the `.wv-chip:hover { ... }` rule and re-add it inside `@media (hover: hover) and (pointer: fine) { ... }` directly below it.
2. `swiss.css:614-615`: same for both `.dmx-chip:hover` rules.
3. `swiss.css:747` and `:749`: same for both `.pk-btn:hover` rules. Leave `.pk-btn.pk-primary` (line 748, not a hover rule) where it is.
4. Search for other un-gated motion hovers: `grep -n ":hover" web_live_build/swiss.css`. Only wrap rules that animate or invert a control; leave pure colour-only text-link hovers alone unless they visibly stick on touch.
5. Bump `swiss.css?v=N` in index.html and `CACHE_NAME` in sw.js.

## Boundaries

- Do NOT change colours, sizes or timing.
- Do NOT touch Tailwind classes in index.html (`hover:` utilities already compile into hover-media rules in Tailwind 3.4+).
- If line numbers drifted, STOP and report.

## Verification

- **Mechanical**: no syntax change in JS; load the page and confirm swiss.css parses (the page renders styled).
- **Feel check**: in DevTools device mode (a phone preset with touch), tap a mood chip, a "Pick for me tonight" button and a where-to-watch chip: after the tap, no chip stays filled or inverted unless it is the selected one. On a desktop mouse, hovering still fills the chip from the left.
- **Done when**: no hover-only fill remains after tapping on a touch emulation; mouse hovers unchanged.
