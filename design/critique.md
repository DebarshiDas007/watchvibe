# WatchVibe: what keeps it from feeling premium, and three ways forward

Designer, 20 Nov 2026. Looked at the live site (https://watchvibe-b92.pages.dev/) in Chromium with viewport emulation at 375 x 812, 768 x 1024 and 1440 x 900, and read `web_live_build/index.html`, `games.js`, `tailwind.config.js`, `src/fonts.css`, `favicon.svg`, `manifest.json`. Measurements below are computed styles from the live DOM, not guesses from screenshots.

Mockups (open directly in a browser, no build):
- `design/direction-a.html` Graphite
- `design/direction-b.html` Projector (recommended)
- `design/direction-c.html` Marquee

Each shows the desktop screen (top bar with wordmark, hero, vibe chips, poster row, Daily Challenge card, film card, Game night card) and the same screen in a 375 px phone frame, plus button, chip, loading, empty and error states.

---

## 1. What already works (keep it)

- Poster-first rows with real TMDB art, 2:3 crops, one line of meta. This is the product.
- TMDB title logos in the hero instead of typed titles. Looks expensive for free.
- The verdict vocabulary on the detail page (Absolute Cinema, Paisa Vasool, Timepass, Left at Interval). It is the most characterful thing in the app; it should get better type, not be replaced.
- The Daily Challenge question screen: picture on top, 2 x 2 answer grid, a timer bar, clues below. Clear and fast.
- Dark UI, sticky header, bottom tab bar on phones, `prefers-reduced-motion` already respected in several places.
- Self-hosted fonts and a strict CSP. All three directions stay inside it.

## 2. What makes it feel less than premium, ranked by impact

1. **Colour has no job, so it reads as noise.** The chrome uses nine Tailwind colour families (in index.html: purple 66 uses, emerald 38, rose 35, amber 20, blue 10, cyan 6, plus green, red, pink). The Daily card is a purple-to-blue wash (`from-purple-500/15 via-blue-500/10`), the Game night card a pink-to-purple wash, level pills are emerald/amber/rose, the 7 vibes have 7 colours, the 6 verdicts have their own colours, the 5 "feelings" have another 5. Purple is at once the wordmark, active tab, Swipe button, links, kickers, focus ring and the "Mind blown" vibe. The favicon is a third identity again (a rose-purple-cyan gradient W with a blur glow). Posters already bring all the colour a screen can take; the UI competing with them is the single biggest reason it looks like a template rather than a product.

2. **No type system.** 16 different arbitrary pixel sizes in the markup (9, 10, 10.5, 11, 11.5, 12, 13, 13.5, 14, 15, 17, 19, 20, 22, 28, 34 px) and 13 different white-opacity steps for text (`text-white/30` up to `/90`). Fraunces 500 is used for section heads, card titles, the wordmark, the Daily kicker numbers and the detail title. Its soft, ball-terminal shapes say "cosy bookshop", not "cinema", and in the wordmark at `tracking-[0.18em]` uppercase it reads like a boutique-hotel sign. That is the wordmark the owner dislikes, and the reason is the type, not only the colour split.

3. **Low-contrast text is everywhere.** Computed against `#0B0B0F` / `#14141A`: `white/30` = 2.6:1, `/35` = 3.1:1, `/40` = 3.8:1, `/45` = 4.5:1 on the background but 4.4:1 on the `white/[0.06]` cards. Together these four steps are used 155 times, e.g. poster meta "2026 · Prime Video" (`/45`, 12 px), locked Daily clues (`/30`), the empty "recent rounds" text (`/40`), Daily stat labels (`/45`, 11 px). Thin grey text on black is the classic "cheap dark mode" tell, and it fails WCAG.

4. **Phones do not see a poster for almost two screens.** At 375 x 812 the first poster heading ("Streaming now") starts at y = 1452 px. Above it: category pills and two native selects (y 80-170), a 360 px hero, the Daily card, the Game night card and a 390 px mood panel. Gaps between these blocks are `space-y-14` (56 px) with about 40 px of extra dead band around the cards. A poster-first app opens on two gradient banners and a form.

5. **Tap targets under 44 px on phones.** Category pills and mood chips 32 px tall, leaderboard tabs 32 px, hero prev/next/mute/pause 36 x 36, language and vibe selects 35 px, "View details" 40 px. Game night: colour swatches 22 x 22, eraser/undo/clear 32 x 32, header buttons (copy link, WhatsApp, sound, leave) 32-38 x 32. Desktop: the seven icon-only nav buttons are 29 px tall next to 39 px text tabs.

6. **Components disagree with each other.** Seven radii in use (`rounded-full` 200, `2xl` 65, `xl` 26, `md` 14, `lg` 7, `3xl` 5, `[28px]` 3, plus `[3px]`). Every primary action is the same white pill (`bg-white text-black`), so the Daily landing shows three identical white "Play" buttons and nothing is primary. Home content starts at x = 36 px and is 1360 px wide; Daily is `max-w-5xl` (1024 px) and starts at about x = 208 px, so the left edge jumps when you switch tabs. Game night has its own header ("Game night" in Fraunces, no wordmark) and its own chip and card styles.

7. **Navigation chrome is cryptic and fussy.** Desktop header: Home, Movies, Series, Stand-Up, then seven unlabeled icons (layers, scan, heart, bookmark, user, bolt, gamepad: Vibe Deck, Watch together, Taste Match, Watchlist, Profile, Daily, Game night). Nobody can read those. The language/vibe `<select>`s float right-aligned above the hero with a 44 px empty band. On phones the Swipe tab is a purple gradient circle that pokes out of the bar.

8. **Loading and empty states are bare.** Search results show flat `#14141A` rectangles with no shimmer while posters load. At 768 px the hero is a pure black box until the backdrop arrives. Scrolling quickly on desktop shows a fully black viewport between rows (lazy rendering with no placeholder). Guest Profile is "0 Movies, 0 Series, 0 Saved", one sentence and half a screen of nothing; Daily landing opens with "0 / 0 / 0" stats.

9. **The detail page is a pop-up, not a page.** Desktop: a 760 px modal over the full home page, dimmed but not blurred, so the home hero and Daily card stay visible around it. Phone: a sheet inset 12 px with the home page peeking. It works, but premium film apps give the title the whole stage.

10. **Leftover gimmicks.** Genre-styled fallback hero titles with neon text-shadows (cyan glow for sci-fi, orange offset shadow for action), a green glow on the correct Daily answer (`shadow-[0_0_22px_rgba(74,222,128,.55)]`), emoji in toasts and stats (🔥 📧 👋 ⚠️), Font Awesome's mixed solid/regular/brands icons (100 KB CSS + 147 KB solid font + 105 KB brands for about 50 icons).

---

## 3. Three directions

### A. Graphite
*Quiet, expensive, out of the way: neutral graphite and white, so the posters are the only colour on screen.*

- Colours: bg `#0E0F11`, surface `#16181B`, elevated `#1F2226`, line `#2A2E34` (decorative), line-strong `#5F6670` (controls, 3.1:1), text `#F3F4F6` (17.4:1), text-2 `#B4B9C1` (9.7:1), muted `#8E949D` (6.3:1 on bg, 5.2:1 on elevated). One accent, Glacier `#8DB6FF` (9.4:1), only for focus, progress and the active tab. Primary button is near-white with dark text (17.4:1).
- Vibes: equal-lightness pastels, dots and small labels only. Must watch `#7FD3A6`, Mind blown `#ABA6FF`, Fun time `#6FCBE3`, Emotional `#F29DB0`, Hidden gem `#E7C47F` (8.2 to 10.7:1 on surface).
- Type: Inter only (already shipped, 400 to 700). Display 64/64 at -0.035em, section 24/30, body 15/22, meta 13/18, caption 12/16 minimum. Fraunces removed (saves 66 KB).
- Spacing 4/8/12/16/24/32/48/64. Radius poster 10, card 16, button 12, chip pill.
- Cards: tone steps plus 1 px hairline, no gradients. Shadow only on sheets.
- Hero: full-bleed backdrop, left-to-right scrim, plain white title, small Glacier "live" dot in the kicker.
- Wordmark: lowercase "watchvibe" in Inter 650 at -0.035em, with a half-filled circle mark (a mood dial).
- Feels like a well-made streaming service's own app: calm, neutral, a little cold.

### B. Projector (recommended)
*The moment the lights go down: warm theatre-black, ivory type, one brass accent like a marquee bulb.*

- Colours: bg `#110D0B`, surface `#1A1512`, elevated `#241D19`, line `#382C25`, line-strong `#75624F` (3.1:1), text ivory `#F5EEE6` (16.8:1), text-2 `#CDBFB2` (10.8:1), muted `#A08F81` (6.2:1 on bg, 5.3:1 on elevated). Accent brass `#E2B35E` (10.0:1), with dark `#1A1208` text on it (9.6:1). Hover `#ECC37A`, pressed `#CFA052`.
- Vibes, warmed: Must watch takes the house brass `#E2B35E`, Hidden gem becomes jade `#6FC7A4` (a real gem), Mind blown lilac `#BBA6F2`, Fun time sky `#7FC6E6`, Emotional terracotta-rose `#EC9A8E` (8.3 to 9.6:1 on surface).
- Type: Instrument Serif (OFL, regular + italic, one weight) for titles at 24 px and up only; Inter for everything you read or tap. Display 88/84 (60 on phones), section 34/38 (28 on phones), titles 17 Inter semibold, body 15/22, caption 12/16 minimum. Italic is used for one word per heading ("Streaming *now*").
- Spacing 4/8/12/16/24/32/48/64, row gap 56 desktop, 44 phone. Radius poster 6 (a printed one-sheet), card 14, buttons and chips pill.
- Cards: warm tone steps, soft poster shadow (0 14px 30px -14px / 80% black). The Daily Challenge becomes a cinema ticket with a tear-off stub ("#20, today"), which also gives Game night and Daily one shared language.
- Hero: full-bleed, slight warm grade on the backdrop (`saturate(.9) sepia(.08)`), vignette, optional static film grain (one 400-byte data-URI SVG, allowed by the CSP's `img-src data:`).
- Wordmark: "Watch*vibe*" in Instrument Serif, roman then italic, one colour, normal tracking, with a small brass full stop. No caps, no wide tracking, no two-colour split.
- Feels like an independent cinema's programme or a good festival app: warm, adult, unmistakably about film.

### C. Marquee
*A film-festival programme in your pocket: black, paper white and one vermilion, condensed headlines, rules instead of boxes.*

- Colours: bg `#090909`, surface `#141414`, elevated `#1E1E1E`, rule `#2E2E2E`, line-strong `#66665F` (3.2:1), text `#FAFAF7` (19.0:1), text-2 `#BDBDB6` (10.5:1), muted `#93938C` (6.4:1, 5.4:1 on elevated). Accent vermilion `#FF5A36` (6.4:1) with black text on it (6.4:1). White on vermilion is only 3.0:1, so never white.
- Vibes as flat square labels with black text: Must watch lime `#B9F26E`, Mind blown `#BBA9FF`, Fun time `#72E4F2`, Emotional `#FF93A6`, Hidden gem `#FFCB52` (9.4 to 15.1:1).
- Type: Anton (OFL, one weight) uppercase for display and section heads at 24 px and up; Inter for UI, with bold uppercase 12.5-13.5 px labels. Display 132 px desktop, 72 phone.
- Spacing as above. Radius 2 on posters, 4 on everything else. No shadows: hierarchy from 1 px rules, 4 px coloured top borders and size.
- Hero: editorial split on desktop (text column left, backdrop right, square corners) with a 01-05 numbered pager; on phones the picture sits on top and the title below.
- Wordmark: "WATCHVIBE" in Anton with a vermilion bar.
- Feels like a festival poster or a printed magazine: confident and loud. Risks: uppercase condensed type is hard on long regional titles ("Godhi Banna Sadharana Mykattu" runs to three lines at 40 px); red-orange plus black sits close to the biggest streaming brand; it is the hardest to keep consistent across 2.6 MB of markup.

### Comparison

| | A. Graphite | B. Projector | C. Marquee |
|---|---|---|---|
| Mood | calm, neutral, tech-premium | warm, cinematic, adult | loud, editorial, festival |
| Background / surface | `#0E0F11` / `#16181B` | `#110D0B` / `#1A1512` | `#090909` / `#141414` |
| Accent (contrast on bg) | Glacier `#8DB6FF` 9.4:1 | Brass `#E2B35E` 10.0:1 | Vermilion `#FF5A36` 6.4:1 |
| Lowest text colour | `#8E949D` 6.3:1 | `#A08F81` 6.2:1 | `#93938C` 6.4:1 |
| Primary button | near-white, dark text | brass, dark text | vermilion, black text |
| Display font | Inter (shipped) | Instrument Serif (new) | Anton (new) |
| New font files | none, and Fraunces removed (-66 KB) | 2 (regular + italic) replace Fraunces | 1 replaces Fraunces |
| Radius | 10 / 16 / 12 | 6 / 14 / pill | 2 / 4 / 4 |
| Vibes | pastel dots | warmed dots, brass = Must watch | solid square labels |
| Wordmark | lowercase Inter + dial mark | serif "Watch*vibe*." | Anton caps + bar |
| Distinctiveness | low to medium | high | very high |
| Risk | can feel generic | gold turns cheap if anyone adds gradients or glows | long titles, brand-red association, hard to keep consistent |
| Effort to build | lowest | medium | highest (layout changes in hero and section heads) |
| Fit for "movie lovers, India and worldwide, on phones" | good | best | good on marketing, weaker for daily browsing |

New-font sizes are estimates (Google's latin subsets are typically 20 to 40 KB per file); measure the actual woff2 before shipping.

### Recommendation: B, Projector, with A's discipline

- It is the clearest break from "near-black plus bright purple" while staying dark, poster-first and fast.
- Warm black flatters poster colour. Skin tones and the saturated, warm palettes of Indian film posters look richer on `#110D0B` than on blue-black `#0B0B0F`.
- Brass reads premium in India (festive gold) and worldwide (marquee lights, award statuettes) without being a trend colour.
- A real cinematic serif gives the "film" feeling the current Fraunces was reaching for, and the Indian-English verdict names (Paisa Vasool, Left at Interval) look great set in it.
- The ticket card gives Daily Challenge and Game night one visual language with Home, instead of two gradient banners.
- Rules that keep it premium: brass is flat (no gradients, no glow, no gold text-shadows); one brass element per view region; serif only at 24 px and up; vibe colours only as dots and small labels; everything else from tokens.

If the owner wants the lowest risk and zero new fonts, choose A. C is best kept for marketing (OG image, share cards for Daily results).

---

## 4. Build spec (for B; steps 1-4 are worth shipping whichever direction is chosen)

Each step can ship alone. After each one: `npm run build:css`, syntax check, `runProductSweep()` at 375/768/1440, bump `sw.js`.

**Step 1. Text contrast floor (any direction).** `web_live_build/index.html` and `games.js`: replace `text-white/30`, `/35`, `/40` and `/45` with `text-white/60` for now (7.3:1 on `#0B0B0F`). These steps are used about 155 times. Dashed "locked clue" placeholders in the Daily (`renderDaily`, line ~4463) go from `text-white/30` to `text-white/55`. In step 5 these become the `muted` token.

**Step 2. Tap targets (any direction).**
- Category pills, mood chips, leaderboard tabs, Daily level chips: `py-1.5`/`h-8` to `h-11` on phones (`h-11 sm:h-10`), `px-4`.
- Hero carousel buttons (prev, next, mute, pause): `h-9 w-9` to `h-11 w-11`; "View details" to `h-12 px-6`.
- Language/vibe `<select>`s: `h-11`.
- Desktop icon nav in `#topCategoryNavBar`: make every button `h-11` and show text labels from `lg:` (`<span class="hidden xl:inline">Daily</span>` etc.), or move the less-used ones into a "More" menu.
- `games.js`: colour swatches keep a 24 px visual circle inside a 44 x 44 button (`p-2.5`); eraser, undo, clear, copy link, WhatsApp, sound and leave buttons `h-11 w-11`.

**Step 3. Minimum 12 px text (any direction).** Replace `text-[9px]`, `text-[10px]`, `text-[10.5px]`, `text-[11px]`, `text-[11.5px]` with `text-xs` (12/16). Exception: bottom-nav labels may stay 11.5 px if they also have an icon.

**Step 4. Phone home order (any direction).** In the home render: hero, then a single row of vibe chips (replacing the two `<select>`s), then "Streaming now", then the Daily card, then Game night, then the remaining rows. The free-text mood box moves below the first row or into Search. Target: the first poster row heading at or above y = 760 on a 375 x 812 screen (today 1452).

**Step 5. Tokens.** `tailwind.config.js` `theme.extend.colors`:
```
bg: '#110D0B', surface: '#1A1512', elev: '#241D19',
line: '#382C25', 'line-strong': '#75624F',
ink: '#F5EEE6', 'ink-2': '#CDBFB2', muted: '#A08F81',
brass: { DEFAULT: '#E2B35E', hover: '#ECC37A', press: '#CFA052', ink: '#1A1208' },
vibe: { must: '#E2B35E', mind: '#BBA6F2', fun: '#7FC6E6', emo: '#EC9A8E', gem: '#6FC7A4', pass: '#CDBFB2' }
```
Update the `:root` variables in index.html (lines 41-56) to the same values. `body` background to `#110D0B`; `meta theme-color` and `manifest.json` `theme_color`/`background_color` to `#110D0B`. Then sweep: `bg-[#0B0B0F]` to `bg-bg`, `bg-[#14141A]` to `bg-surface`, `bg-white/[0.04]` and `bg-white/[0.03]` cards to `bg-surface`, `ring-white/10` on cards to `ring-1 ring-line`, `text-white` to `text-ink`, `text-white/55` to `/70` to `text-ink-2`, `text-white/60` to `text-muted`, `text-purple-300`/`400` to `text-brass`, `selection:bg-purple-500` to `selection:bg-brass selection:text-brass-ink`.

**Step 6. Fonts.** Add `instrument-serif.woff2` and `instrument-serif-italic.woff2` (latin subset, OFL) to `web_live_build/vendor/fonts/`; in `src/fonts.css` replace the Fraunces `@font-face` with these two (`font-weight: 400`, `font-display: swap`, same `unicode-range`); in `tailwind.config.js` set `display: ['Instrument Serif', 'Georgia', 'serif']`. Remove `fraunces.woff2`. Because Instrument Serif has one weight, drop `font-medium` from every `font-display` element and size up instead: section heads `text-[28px] lg:text-[34px] leading-tight`, card titles `text-2xl`, Daily `h1` `text-4xl lg:text-5xl`. Nothing below 24 px uses `font-display`; the Daily card title and stat numbers that are 17-20 px today switch to Inter semibold.

**Step 7. Buttons.** One primary per view: `h-12 rounded-full bg-brass px-6 text-[15px] font-semibold text-brass-ink hover:bg-brass-hover active:scale-[.97] active:bg-brass-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:bg-elev disabled:text-muted`. Secondary: `h-12 rounded-full px-6 text-ink ring-1 ring-line-strong hover:bg-ink/5`. Ghost: `text-ink-2 hover:text-ink`. On the Daily landing only the first unfinished level gets the primary; the others become secondary. Remove the green glow on the correct Daily answer; use `bg-vibe-gem text-brass-ink` with a check icon.

**Step 8. Wordmark and icons.** Header button (index.html line 678): `font-display text-[28px] lg:text-[30px] tracking-[-0.01em] text-ink` with markup `Watch<em class="italic">vibe</em><span class="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-brass align-baseline"></span>`; remove `tracking-[0.1em]`/`[0.18em]` and the purple span. Favicon and app icons: an ivory italic "v" on `#110D0B` with a brass dot (no gradient, no blur); og-image to match. Later, replace Font Awesome with an inline SVG sprite of the ~50 icons in use (1.6-1.75 px stroke, as in the mockups); that also removes about 250 KB of CSS and font.

**Step 9. Cards and vibes.** Daily card (`dailyCardHtml`, line ~4572) becomes the ticket: main area `rounded-l-[14px] bg-surface p-6` and stub `w-[150px] border-l-[1.5px] border-dashed border-line-strong` (92 px on phones), notches with the CSS mask in the mockup; level pills become three thin progress bars (`h-[3px] bg-elev` with a `bg-brass` fill). Game night card (`gamesCardHtml`, line ~4563): same surface, a 44 px round outlined icon, no pink gradient. Vibes: chips are `bg-surface ring-1 ring-line` with a 7 px dot in the vibe colour; selected is `ring-brass bg-[#2A2116] text-ink`. Map `--must-watch` and friends to the new vibe values; verdict and feeling colours on the detail page reuse the same five vibe colours plus `ink-2`, instead of eleven separate hues.

**Step 10. Hero, loading and empty states.** Hero: add the warm grade, vignette and grain layer from the mockup, and show the TMDB logo or a serif title fallback (delete the genre neon text-shadows in `fallbackTitleLook`). Give the hero a `bg-surface` placeholder plus the poster's dominant tone while the backdrop loads. Poster placeholders get the 1.6 s shimmer from the mockup (`bg-elev` with a `#33291F` highlight; no animation under reduced motion). Empty Watchlist, Profile and Daily first-run use the "seats" illustration pattern and one primary action, and hide "0 / 0 / 0" stats until there is something to show.

**Step 11 (larger, optional).** On desktop, open the title detail as a full page (or a full-height sheet at least 1040 px wide with a blurred, darkened backdrop) instead of a 760 px modal over Home.

---

## 5. What I could not check

- Only Chromium with viewport emulation. No real iPhone or Android device, no Safari or Firefox, no real slow network.
- Fonts in the mockups load from Google Fonts for preview only; in the embedded preview Inter sometimes fell back to the system font. Instrument Serif and Anton file sizes are estimates until the latin-subset woff2 files are made and measured.
- I did not visit the detail page, Watchlist, Profile, Search or Game night at 768 px, and I saw Game night's drawing screen only at 375 px. Movie Fibber and Who's the Impostor? screens were not seen.
- Contrast ratios are WCAG 2.x relative-luminance values computed from the hex tokens. Text over photographs (hero, Daily picture) depends on the image; the scrims in the mockups are designed for 4.5:1 or better on dark backdrops, but very bright backdrops were not tested.
- While testing I started an Easy Daily round and made a short-lived Game night room (code XD73W, joined from a second tab, then left from both). Both happened only in the preview browser.
- In that test, the background tab took over as host and showed the active tab as "away". That looks like background-tab throttling, but it may be worth a quick look by the tester.
