# ðŸŽ¬ WatchVibe â€” Project Handoff

> Read this file (and `memory/HANDOFF.md` for product/stack background) at the start of every session.

## 1. Overview

| | |
| :-- | :-- |
| Product | Movie/TV discovery PWA with "vibe" ratings |
| Live | https://watchvibe-b92.pages.dev/ (Cloudflare Pages â€” the only hosting target) |
| Repo | https://github.com/DebarshiDas007/watchvibe (`main`) |
| Root | `D:\watchvibe` |
| Shipped app | `web_live_build/index.html` (single-file SPA/PWA) |
| Flutter port | `lib/` â€” **experimental, not buildable yet** (platform folders are stubs, no tests, `dart:io` blocks web). Treat as a prototype. |

## 2. Architecture

- Frontend: vanilla JS + Tailwind (CDN) in one HTML file; TMDB for metadata; Supabase for auth + cloud sync.
- **Auth is real Supabase Auth only** (magic link, password, Google/Discord OAuth). The session lives in Supabase's own storage; `currentUserSession` is derived from it in `setLoggedInUser()`. The old email-only "profile" login was removed (it let anyone sign in as anyone, including the admin).
- **Authorization is enforced by Supabase RLS** (`supabase/schema.sql`), not by the page. `isSuperAdmin()` in the page is only a UI gate.
- Cloud data: `user_watchlists` (one row per `auth.uid()`), `profiles` (auto-created by trigger), `battle_votes`, `vibe_ratings`.
- Security headers + CSP: `web_live_build/_headers` (Cloudflare Pages). Inline scripts/handlers still require `'unsafe-inline'`.
- **No runtime CDNs.** Tailwind is compiled (`npm run build:css` -> `web_live_build/tailwind.css`; `python deploy.py` rebuilds it automatically; run `npm install` once). Font Awesome and supabase-js are vendored in `web_live_build/vendor/`. CSP therefore allows only self + TMDB/Supabase/geo/avatar hosts. If you add new Tailwind classes, rebuild before deploying; do not build class names dynamically (`bg-${x}`), the scanner cannot see them.`n- Service worker (`sw.js`) never caches TMDB/Supabase/geo API calls.

## 3. Operations

```powershell
python D:\watchvibe\deploy.py            # deploy to Cloudflare Pages (needs CLOUDFLARE_API_TOKEN, wrangler)
cd D:\watchvibe\web_live_build; python -m http.server 8080   # local preview
```

Secrets live only in `D:\watchvibe\.env` (git-ignored). Never put credentials, tokens or test passwords in tracked files.

## 4. Manual steps

Done (Nov 2026): `supabase/schema.sql` applied (legacy tables kept as `*_legacy`, permissive policies dropped); Site URL + redirect URLs set; leaked `vibe_tester@watchvibe.app` deleted.

Also done: leftover test users deleted (only real users remain); custom SMTP via Brevo is live (Supabase -> Authentication -> Emails -> SMTP Settings; host smtp-relay.brevo.com:587, key named `supabase-auth`, free plan 300 emails/day, account `dasdebarshi1234@gmail.com`). The SMTP key lives only in Supabase; never commit it. Brevo rewrites the sender to `...@12828432.brevosend.com`; to send from your own domain later, authenticate a domain in Brevo and update the Supabase sender address.

Still open:
1. Optional: delete the unused original Google OAuth client secret (ending hG03) in GCP project `ambient-catcher-514921-m1`.
2. Optional hardening: move the TMDB key behind a Cloudflare Worker and rotate it (it is public in `index.html`).
3. Back Movie Night rooms and battle voting with Supabase (currently mostly local/hardcoded).
## 5. Phase 2 (done): Mood Picker + honest matching

- AI Vibe Matcher has multi-select moods (cry / mind-blown / laugh / cozy / adrenaline / hidden gems), a runtime filter and genre-aware scoring. Match % is relative to the best candidate; placeholder vote splits (e.g. 100/100/100) are normalised and confidence-weighted.
- Sidebar user card and Profile page show the real signed-in user and real watched/watchlist stats (the hardcoded fake persona is gone).
- Login page: green success state, 30s resend cooldown, optional display name, expired-link error handling. Google/Discord show SOON until you flip `OAUTH_ENABLED` in `index.html` after enabling the provider in Supabase.

## 5b. Recent work (Nov 2026) and where it stands

- **Sign-in window:** redesigned (two-column on desktop, 800px; 920px once signed in; single column on phones). Smooth open/close, staggered reveal, drawer animations (CSS `av-*` keyframes, respects reduced motion). Signing in no longer closes and re-opens it: `setLoggedInUser` keeps it open and shows the icon picker in place.
- **Profile icons:** 8 original illustrated avatars (`AVATARS` array in `index.html`; Dark Lord, Clown Prince, Iron Hero, Grey Wizard, Pirate Captain, Web Slinger, Mafia Don, Friendly Alien). Saved in Supabase user metadata (`character`) plus localStorage; shown in header, sidebar, Profile page and sign-in window. First sign-in without a choice opens the picker once.
- **Actor profiles:** restyled to match the app; each profile loads at least 10 best-known titles from TMDB credits (`enrichActor`); broken filmography posters are repaired via TMDB (`fixFilmPoster`); searched people open their own profile (was opening Robert Downey Jr.).
- **Search tab:** header search button is hidden there so only one search box shows.
- **PENDING (waiting for your pick):** more icon options were shown in chat but are NOT in the app: 12 Hollywood/genre looks (Night knight, Space ranger, Friendly robot, Samurai, Cowboy, Vampire count, Spy agent, Popcorn buddy, Ghost, Dino, Warrior queen, Shield captain) and 8 Indian-cinema looks (Retro hero, Classic villain, Angry young man, Romantic hero, Mass hero, Retro diva, Outlaw, Maharaja). Suggested final picker size: 12 to 16. Their drawings are not saved in the repo; ask Claude to redraw the ones you choose.
- **Admin dashboard (`/admin`, file `web_live_build/admin.html`):** replaces the old pop-up Command Studio and its fake numbers. Tabs: Overview (visitors, visits, funnel, countries, devices, referrers, top titles, searches, zero-result searches, mood requests), Users (real accounts from Supabase auth, filter, sort, CSV export), Content health (broken posters, failed trailers, titles not watchable per country, most opened and saved, vibe votes), Streaming (clicks by service and country), System (event counts, DB size, app version, recent errors, purge old events). Sign in on the site with the admin account first; the data functions refuse anyone else.
- **How analytics work:** `Track` in `index.html` queues anonymous events and POSTs them in batches to the Supabase `events` table (insert-only for visitors). No emails, names or IPs; random visitor id `wv_vid` in localStorage; skipped for Do Not Track / Global Privacy Control and for the admin's own browsing; max 250 events per page load. Event types are whitelisted by a CHECK constraint. Reports are SECURITY DEFINER functions (`admin_overview`, `admin_users`, `admin_content`, `admin_streaming`, `admin_system`, `admin_purge_events`) that raise "not authorized" unless `is_admin()` (verified email listed in table `admins`). All SQL is in `supabase/admin_analytics.sql` (already applied, safe to re-run). To add an admin, insert their email into `public.admins`.
- Not built yet: delete or block a user (needs a server function with the service key), email broadcasts, announcements, feedback inbox, admin action log.
 - **Direct watch links:** the buttons in Where to watch open the title's own page on each service (Prime Video detail page, Netflix /title/ID, JioHotstar movie page, Apple TV movie page and so on), not a search page. Source: JustWatch's public GraphQL endpoint via our Cloudflare Pages Function unctions/api/links.js (GET /api/links?tmdb=&type=&cc=&title=; cached 6 h at the edge; only /api/* hits the function via web_live_build/_routes.json). The client (upgradeDirectLinks in index.html) first renders the old search links, then swaps in the direct ones when the lookup returns; if the lookup fails or a service has no direct page (YouTube, Google Play), the search link stays. Sample coverage: India 88%, US 77%, UK 92% of buttons. JustWatch's endpoint is unofficial, so it could change; the fallback keeps links working. deploy.py now runs wrangler from the repo root so the functions folder is bundled.
 - **More like this:** rewritten (getSimilarBundle in index.html). Shows a franchise row (all other parts of the TMDB collection in release order, labelled Part N) plus a ranked list. Candidates = TMDB recommendations + TMDB similar + our catalogue. Score = weighted genre overlap (specific genres like Sci-Fi/Horror count more than Drama/Adventure) with mismatch penalties (Animation, Documentary, Horror), same director, shared cast, plot-description similarity (TF-IDF), language match (strong for Indian languages), era, rating/votes quality, small TMDB-list bonus, and the viewer's own genre taste from watched/saved. An instant catalogue-only list shows first and is replaced when TMDB answers. Measured on 58 titles: defining-genre match 34% (old) to 79% (new). The window shows 8 titles, 4 per page with side arrows (simPage/simArrows; 2 per page on phones); franchise row shows up to 12.
 - **Verdicts and reviews (replaced the old vibe bars):** in the details window, people pick one of 6 verdict tiers (1 Absolute Cinema, 2 Standing Ovation, 3 Paisa Vasool, 4 Worth a Watch, 5 Timepass, 6 Left at Interval) plus ONE feeling (Moved to Tears, Laughed Out Loud, Mind Blown, Hidden Gem, Good Timepass; picking another replaces it, tapping it again clears it; one-time migration in supabase/feelings_v2.sql, already applied). Votes are real and shared: table title_votes (one per user per title; nobody can read other people's rows), totals via RPC title_vote_summary. Title key = tmdb id (movie:ID / tv:ID). The community bars show only from 3 votes; otherwise 'Be the first'. Reviews: table title_reviews (headline 2-140 chars, optional body up to 500 words, spoiler flag, one per user per title; no links; 10 per hour), read through RPC title_reviews_list (no user ids exposed), 'Felt this too' = review_reactions (not on your own review), Report = review_reports (3 different reporters auto-hide a review; admin can Hide, Restore, Delete in /admin Reviews tab via admin_reviews/admin_review_status/admin_review_delete). Client code: the Verdicts block above detailBodyHtml in index.html (vs* functions, fillVibes). SQL: supabase/reviews.sql (applied, safe to re-run). Signed-in only; verdicts also feed the viewer's watched history and taste persona. The old seeded vibe bars and the old castUserVibe code have been removed. Not built yet: viewers-like-you, watched-with tags, diary.
 - **Watchlist as a diary (step 1 done):** saved titles keep their own details (userWatchlistMeta, synced in watchlist_data.watchlist_meta) so titles outside the catalogue show; unresolved TMDB ids are looked up once (esolveWatchlistMeta). Watched cards show your verdict badge, feeling chip and review line (data from your own title_votes and title_reviews via libLoad/LIB, refreshed by libInvalidate), with Edit or Add verdict. 'Mark as seen' (details window and Want to watch cards) now opens the 'How was it?' sheet (markSeen, openRateSheet, ateSheetSave): pick a rung, optionally a feeling and a review, then it saves the verdict, marks the title watched and removes it from Want to watch; 'Skip for now' marks it watched without a verdict; signed-out visitors just mark it watched. Step 2 done: Watched has a 'Your taste' card (verdict mix bar, usual verdict, favourite genres from titles you rated highly, top feeling, counts; guests see the older vibe bar), filters (verdict, feeling, type), sorting (recently watched, your rating, newest release, A to Z), grid or list view (state WL, saved in localStorage watchvibe_wl_ui), and a My reviews tab (all your reviews with Edit and a two-click Delete). Step 3 done: Want to watch cards show where each title streams in your region (wantAvail, from TMDB/JustWatch; 'On JioHotstar +2', 'Rent or buy only', 'Not streaming in India'), the community verdict once a title has 3+ verdicts (batch RPC title_verdicts, SQL in supabase/verdicts_batch.sql, applied), a Streaming now / Rent or buy / Not available filter, sorting (recently added, highest rated, newest release, A to Z), and a 'Pick one for tonight' sheet (openTonight: weighted random pick that leans towards what is streaming and well loved, never repeats within a round, direct watch link). Sync now uses newest-copy-wins (modified_at in watchlist_data plus localStorage _lastmod) so removals carry across devices; the first sync on a device still combines both copies once.
 - **Poster/card alignment (in progress, paused 17 Nov 2026):** cards are buttons, which centre their content vertically, so a card with a 1-line title sat lower than a neighbour with a 2-line title. Fixed for poster cards and actor film cards by adding self-start (commit 98f2e8b, live). The new audit tool tests/card-alignment.js (paste in the console at 375, 768 and desktop widths, then wait runCardAudit()) found 0 image misalignments across 29 screens at 375 and 768 px. Not yet checked: desktop width and 320 px with the full audit. Open idea, not built: the lines under each poster still differ in height (title 1 vs 2 lines, badge lines), so card bottoms and the rating line are ragged. Proposed fix: reserve two title lines (min-height about 2.25rem, no clipping so long titles still grow), and in the watchlist cards make the card a flex column with the action buttons pinned to the bottom so they line up across a row.
- Service worker cache is at v41; bump it on every deploy.

## 6. Testing

 - **Where to watch** is live per-region data from TMDB (JustWatch), fetched when a title opens. The old embedded per-title streaming/ottPlatform fields were fabricated and have been removed. Region = user choice > Cloudflare /cdn-cgi/trace (real IP country) > ipapi.co > country.is > time zone. tests/ott-audit.js (await runOttAudit()) checks every title x 15 regions (no phantom or dropped services, valid links). Providers are normalised in tidyProvider(); per-service links are built in buildProviderLink() (unknown services fall back to the TMDB/JustWatch page for the region).
- **Last full smoke test (17 Nov 2026, live site, signed in as admin):** all passed. Server: pages, assets, headers, /api/links, database access rules as a visitor. App: home, tabs, filters, mood picker, search, actor pages, details for movie/Indian/series/stand-up/franchise, region switching with direct links, sign-in window and icons, Vibe Deck, Movie Night, verdict and review flow (incl. guards and admin moderation, throwaway data deleted), watchlist tabs, tonight picker, admin tabs. Scripts: content sweep (2,059 titles, 874 views, 0 errors), scroll-to-top 20/20, text clipping 0 at 967px and 375px, OTT audit (30,915 combos clean, 7,500 links valid). Housekeeping from that run is done: the unused public media_database.json (4 MB, old fake streaming data) was deleted, dead castUserVibe() removed, and the empty src on the hidden #swipePoster image fixed.
- Paste 	ests/content-sweep.js into the browser console on the site: renders every title (details window + card) and ~1,000 home/filter views and reports errors, bad text and missing fields. Last run (Nov 2026): 2,059 titles, 1,032 views, 0 errors; 4,118/4,118 poster+backdrop images load; 1,920/2,059 titles have a TMDB trailer (the other 139 show the backdrop only).

## 7. Known gaps / roadmap

- Admin Studio analytics are local-only (localStorage); only the user list comes from Supabase (`profiles`, admin-only via RLS).
- Watchlist cloud merge is union-only (removals on one device don't propagate).
- `index.html` is ~5k lines of inline JS/CSS; split into modules with a build step when practical. Many `innerHTML` templates still interpolate TMDB strings â€” use `esc()` for any new/changed template.
- Flutter port: finish or delete.
- Add real PWA icons (manifest currently points to Unsplash photos).

- (SW v43) Fixed the cached-catalogue corruption (runtime __sv data no longer saved/loaded) and reserved two title lines under posters; library cards pin their buttons to the bottom. Card audit at 375px: 0 image issues, 47 uneven rows left, all genuine 3-line titles. Not re-audited at 768/desktop/320.

- (SW v45) Title window shows official logo art + age certification (TMDB). Ratings are IMDb only: /api/imdb (functions/api/imdb.js) asks TMDB for the IMDb id then OMDb (key a2434d40 fallback in the function; set OMDB_KEY env to override), edge cached 7 days; the client fills rtHtml() spans only for titles on screen (IntersectionObserver) and caches in localStorage watchvibe_imdb_v1. Free key = 1,000 OMDb calls/day, non-commercial licence. Sorting still uses TMDB scores internally.

- (SW v48) Rating sorts use IMDb: imdbSortVal() for home rankings (cached values), imdbEnsure() loads IMDb ratings first for actor 'Highest rating' and watchlist 'Highest rated'. Hand-written entries (no TMDB id) are resolved by exact title+year via TMDB search (TMAP, localStorage watchvibe_tmap_v1). Accuracy test on 50 random titles vs imdb.com pages: 44 exact, 5 off by 0.1, 1 off by 0.2 (OMDb lags IMDb slightly); old TMDB scores matched 4 of 50.

- (SW v49) SEO: new title/description, canonical, Open Graph/Twitter, JSON-LD, robots.txt, sitemap.xml, own icons + og-image.png (generated by canvas), fixed manifest. All URLs use https://watchvibe-b92.pages.dev; when a custom domain is bought, replace it in index.html (canonical, og:url, og:image, twitter:image, JSON-LD), robots.txt and sitemap.xml. Domain check (DNS, 2026-11): free-looking watchvibe.app/.co.in/.xyz/.club/.top, getwatchvibe.com; watchvibe.com/.in/.co/.net taken.

- (SW v50) Title window: logo/extras cache persisted (localStorage watchvibe_extras_v1, 500 newest, 30 d), hover/touch prefetch (warmTitle), title hidden until the look is decided (<=0.7 s) so the plain font never flashes; titles with no official artwork (~8%, 167 of 2063; 136 have none in any language) get a genre-based fallback look (fallbackTitleLook). Test: tests/title-flash.js (0 flashes; logo median 128 ms cold, ~20 ms warm/repeat). Home hero banner still uses the plain title.

- (SW v51) Featured carousel on Home: 5 titles (HERO_COUNT), 15 s per title (CSS heroFill animation + animationend advances), segmented bar, arrows, swipe, trailer in the active slide (muted until the user turns sound on; silent analytics), official logo + age badge. Pauses: hover (real hover only), keyboard focus, hidden tab, scrolled away, title window open. prefers-reduced-motion: no auto advance. Preview module now takes {ids, muted, silent} so hero and title window share one player. Not auto-advance tested in a visible pane (pane was hidden): bar timing checked via computed animation and a simulated animationend.

- (SW v52) Left sidebar removed: primary nav is now in the top bar (Home, Movies, Series, Stand-Up | Vibe Deck, Movie Night, Taste Match, Watchlist, Profile). Labels on secondary items from xl (1280px) up, icons only below; Vibe Deck and Movie Night icons hidden below lg (1024px) because of space (Vibe Deck still on key S). Search is an icon until 2xl. syncTopNav() now lights the right item for every tab. Content max width 1680px; hero taller on large screens. The account card (name, persona, watched counts) of the old sidebar is gone; updateSidebarUserCard() is a no-op without it.

- (SW v53) Featured banner: synopsis removed, text lowered, banner uses a 16:8 / 16:7 ratio (max 640 px tall) instead of a fixed min-height; page content capped at 1440 px.

- (SW v54) Home is full width like Prime: main padding 16/24/36 px, home viewport max 2400 px (other tabs stay 1440), banner full-bleed (-mx), 21:8 ratio on lg (max 760 px), bigger logo/buttons, home-row posters 150/180/210/235/270 px by breakpoint, grids up to 7 columns at 2xl and 9 at 2200 px.

- (SW v55) Trailer iframe is sized in pixels to always cover its frame (fixes black bars above/below the trailer in the tall phone banner).

- (SW v57) Featured bar rewritten: a JS clock (heroTick every 50 ms, HERO.elapsed) drives the fill and the 15 s change instead of a CSS animation + animationend (it stalled when the browser stopped painting). Hover/focus no longer pause it; added a pause/play button; it counts as visible at 20% on screen. Full loop 1>2>3>4>5>1 tested (~15 s each).

- (SW v58) Daily featured picks: functions/api/featured.js ranks titles per country from TMDB trending (day/week), TMDB popularity, JustWatch POPULAR for the country, recent releases on the big OTT services (TMDB discover + watch providers), Wikipedia most-read articles (exact title match), plus freshness/quality/streaming/regional-language boosts; edge cached until midnight IST. The page (featChoose in index.html) picks 5 from the top 14: no repeat of the last 2 days (localStorage watchvibe_featured_hist_v1), max 1 coming-soon, max 3 per type, >=2 streamable if available; the day's picks are stored (watchvibe_featured_v1) so they stay all day. Falls back to the old rating-based list if the API fails. No scraping of platform pages (their terms forbid it): only public APIs. Reddit/Google Trends not used (no free official API). Free-plan Workers allow 50 subrequests: this uses about 37.

- (SW v59) PROTOTYPE: Watch together (replaces the old local Movie Night). Supabase Realtime broadcast + presence only, no tables: room code (6 chars), invite link /?room=CODE, WhatsApp share (no numbers collected), longest-present = host, late joiner gets state from host. Phases: choose (vote, host adds titles) > lobby (host countdown 10s/1/3/5 min, 'where to watch' + availability in viewer's region) > live (press play, reactions, chat, elapsed timer, tab title flashes) > ended (reaction summary, verdict sheet). Chat 200 chars, 0.7 s rate limit, 12 people cap. Tested with two sessions on live. NOT built yet: admit-guests, per-person service ticks, own-time mode. Easy to remove if it does not fit: it is one block in index.html (// ===== WATCH TOGETHER) plus the modal markup.

- (SW v61) Watch together: 'Which streaming apps do you have?' step (localStorage wt_services / wt_services_set, shared through presence only), who-can-watch markers per title (wtCanWatch/wtWhoHtml: free/ads counts for everyone, subscription needs a ticked app matching the provider name, member's own country), 'Find films everyone can watch' (host, scans top 40 rated films, adds up to 4), 'My apps' button, main view re-renders on presence changes.

## Progress snapshot (service worker v61, last commit a9324b8)
Live at https://watchvibe-b92.pages.dev/ . Everything below is deployed and pushed.

Done this stretch: IMDb ratings (OMDb via /api/imdb, edge cached; sorts use IMDb), title logos + age certification, no font flash, SEO (title, social cards, robots, sitemap, icons), top navigation bar (sidebar removed), full-width home with full-bleed featured banner, featured carousel (15 s clock-driven bar, arrows, pause button, trailers, logos), daily featured picks (/api/featured, refreshed daily at midnight IST, no repeats, stable all day), Watch together prototype (live rooms, invite link, voting, countdown, reactions, chat, apps step, who-can-watch, find films everyone can watch).

Open / next, in the order we discussed:
1. Watch together: admit-before-entering for guests; "watch at your own time" mode (needs a small saved table); test with real phones and several people. It is easy to remove if it does not fit (one block, see its HANDOFF entry).
2. Daily Challenge (Guess the Film): 5 clues, streak, WhatsApp share text, leaderboard (new Supabase table + RPC).
3. Taste Duel (two friends, 10 swipes, compatibility score), then finish Taste Match.
4. Retention ideas not started: watchlist "now streaming" alerts (web push/email), weekly OTT digest, per-title SEO pages with share cards, "Tonight" shortcut.
5. Custom domain: watchvibe.app (about $9/yr) or watchvibe.co.in looked free by DNS check; nothing bought. When chosen, replace the pages.dev address in index.html (canonical, og, JSON-LD), robots.txt, sitemap.xml.
6. Known: OMDb free key allows 1,000 lookups a day (non-commercial); Movie Night rooms are now live, not device-local; TMDB key is public.

- (SW v62) New favicon/app icon: neon gradient 'W' on a dark tile (favicon.svg + PNGs 32/48/192/512, maskable, apple-touch). Design options and speed findings are in the chat of that day: JS is fast (renderDiscover 3 ms, details open 55 ms, no long tasks); suspected lag = backdrop-blur over the playing trailer, always-on trailer iframe, oversized posters (w500 shown at 180 px), full innerHTML rebuild on tab switch.

- (SW v63) SPEED: posters requested at w342 (ps() helper; w185 thumbs), all backdrop-blur removed (was 15 elements), banner fade .3 s, touch-action:manipulation + press feedback, banner trailer only on desktop/fast/not data-saver and started 2.5 s (first) / 1.2 s (later) after the slide shows (heroTrailerAllowed), home page DOM reused for 5 min when returning from another tab (HOME cache in switchTab/refreshViews, only the plain unfiltered home). Measured live: oversized images 36 -> 0, blur elements 15 -> 0, return to home 15 ms -> 2 ms. Frame rate itself was not measurable (pane in background).

- (SW v64) UI pass: compact two-column mood card, 'From your watchlist' row on home, search page with trending titles + browse by vibe, helpful empty watchlist (3 steps + popular titles), Taste Match page rebuilt (Watch together + Taste duel coming soon), two-column Profile, restyled Vibe Deck modal, feed sort select (featured/top rated/newest/most voted, window.feedSort), 'Movie Night' renamed 'Watch together' everywhere, tablet 'More' menu (Vibe Deck / Watch together) between 768 and 1024 px. Tested on a local copy at 1440/800/375; live check after deploy.

- (SW v65) DAILY CHALLENGE (Guess the film): renderDaily/dc* in index.html. One film per IST day chosen by smallest hash(day|id) among ~340 catalogue titles with cast+director+synopsis and >=5000 votes; 5 tries, each wrong guess unlocks a clue and sharpens the backdrop; localStorage wv_daily_play_v1 / wv_daily_stats_v1 (streak, best, distribution) / wv_daily_pick_v1; share text with squares + /?daily=1; home card; nav item 'Daily' (lg+, in the More menu on tablets). Nav labels now show from 1500 px, the search pill widens from 1800 px. LEADERBOARD NEEDS SQL: run supabase/daily_challenge.sql in the Supabase SQL editor (creates daily_scores + daily_submit + daily_board). Until then the board says it is unavailable; everything else works.

- Daily Challenge leaderboard SQL APPLIED in Supabase (daily_scores, daily_submit, daily_board; table closed to direct access). Verified: guests can read the board; a submit via the function stores the first result only (second submit ignored); test rows were deleted (0 rows left). daily_submit takes the display name from profiles.full_name, then auth metadata, else 'Player' (shown as first name + initial). Not yet verified end to end from the site while signed in.

- (SW v66) Daily Challenge made easier: 4 multiple-choice options (the film + 3 look-alikes of the same kind/language/era, same for everyone, dcOptions), 3 tries (DC_MAX), clues unlock per wrong pick (what it is > cast > director + masked story), backdrop blur 6/2/0 px, play state key now wv_daily_play_v2, share text x/3, leaderboard shows x/3 (daily_scores.tries stays 1-5 in the table).

- (SW v67) Daily Challenge is now a ROUND OF 20 films per IST day: 10 Hollywood (en, >=5000 votes) + 10 Indian (>=250 votes; only ~60 such titles in the catalogue, so Indian films repeat across days), alternating, chosen by hash (dcRoundIds, stored wv_daily_round_v1). Each film: 4 options of the same kind, 3 tries, 3/2/1 points, clues + clearer picture; after a pick the answer shows for 2.2 s (3.4 s if missed) then auto-advances; Next film button skips the wait. Final screen: score /60, grade, 4x5 emoji grid, share, list of the 20 films, leaderboard. Play state wv_daily_play_v3, stats wv_daily_stats_v2 (day streak, best score, days played, recent 7 days). Leaderboard SQL v2 APPLIED (daily_scores now has score 0-60 and solved 0-20; daily_submit(p_day,p_score,p_solved); daily_board ordered by score). Verified via simulated signed-in submit: first submit kept, second ignored, name from auth metadata ('Debarshi D.'), test row removed. Scores are trusted from the browser (no anti-cheat).

- (SW v68) Daily Challenge v3 (harder, more varied): fixed template of 20 questions (dcRoundSpecs/DC_TEMPLATE, stored wv_daily_round_v2): easy x6 > medium x8 > hard x6 with famous > less famous films by votes; question types scene (blurred backdrop), zoom (crop), cast, plot (title masked), director, lead (who played the lead), year (which came first). Look-alike options scored by same director/shared cast/franchise/language/genre/era (dcSimilar) with spread easy 14 / medium 8 / hard 4; cast questions exclude look-alikes that share 2 of the 3 names shown. Clock per question 25/20/15 s (saved startedAt, so reload gives no extra time; timeout = miss). Points: 3/2/1 by try (3 for one-try types) + speed bonus 0-2 on a first-try answer (answered in first 33% / 66% of the time) + streak bonus (+1 from 3 correct in a row, +2 from 6). Max 140. Scores stored wv_daily_play_v4, stats wv_daily_stats_v3. Leaderboard score check raised to 0-200 in Supabase (applied). Not built: lifelines, hard/typing mode, themes, friends leagues.

## v69 - Daily Challenge: three levels
- Daily Challenge now has Easy / Medium / Hard, each with its own 20 questions per day (Hollywood and Indian alternating; films split by popularity, Easy = most famous). Player picks a level and may play all three.
- Per-level state/stats in localStorage (wv_daily_play_v5, wv_daily_round_v3, wv_daily_stats_v4, wv_daily_sub_v4).
- Supabase: daily_scores has a level column, pk (day,user_id,level); daily_submit(date,text,int,int), daily_board(date,text). SQL in supabase/daily_challenge.sql, applied.
- Known: only ~62 usable Indian films so they repeat across levels/days; scores are client-trusted.


## v73-74 - Catalogue expansion
- Added web_live_build/catalog_extra.json (5,054 films; built by scripts/build_catalog.mjs from TMDB discover + credits; same fields as built-in films, ids slug-tmdbId). Now ~3,390 Hollywood (English) and ~2,496 Indian films (Hindi/Tamil/Malayalam/Telugu/Bengali plus the built-in Kannada/Marathi/Punjabi).
- Loaded after first screen by loadExtraCatalog() (3 retries); catMerge() dedupes by TMDB id (movie/tv kept apart) and by normalised title+year; extras carry __x so they are not saved into localStorage. Bump CAT.v when the file is rebuilt.
- Daily Challenge waits for the catalogue (dcReady) so every player draws the same films; pool thresholds lowered (hw 2500 votes, ind 150); round key now wv_daily_round_v4.
- Ratings of extras with few votes are weighted toward the average (100 votes at 6.3). Regional languages (Telugu, Kannada, Marathi, Punjabi) are thin because TMDB has few rated films.


## v75 - Daily Challenge phone layout
- Phone: compact header, picture + all four options (2x2) visible together, one answer card with identical height before/after answering (clock row becomes the Next button), correct answer bright green (bg-green-500), no smooth scroll between questions (soft .22s fade via .dc-in), story clue capped at ~250 chars (dcPlot), picture height min(229px,31svh), stats box full width on phones.


## v77 - Featured list trailer speed + phone home
- Featured carousel: trailer starts 350 ms after mount (150 ms for later slides; was 2.5 s / 1.2 s), trailer lookups for all 5 slides are done at mount and memoised (TRAILER_MEMO), preconnect to youtube-nocookie/ytimg, fixed start at 16 s (no wait for duration/seek), fade 500 ms. Volume button is visible from the start and remembers the choice before the video plays (heroSoundUi). Phones now get muted inline trailers too (still off for data saver, 2g/3g, <=2 GB memory, reduced motion).
- Phone home: compact Daily card, shorter mood placeholder.
- Could not test real video playback in the hidden browser pane; logic tested with simulated player messages.


## v78 - Game night (multiplayer)
- web_live_build/games.js (loaded deferred; Tailwind scans it): rooms over Supabase Realtime channel 'gn:CODE' (broadcast event 'g' + presence), join by ?game=CODE link or code, guests with a name, up to 10 players. Host = earliest present player; host runs the state machine and broadcasts full state (gnUpdate/gnPack, time left sent as a duration); next player takes over if the host leaves.
- Games: Draw the Movie (skribbl-style: drawer picks 1 of 3 films, 60-120 s, strokes sent every 80 ms, host checks guesses, private 'very close' hint, letter hints at 50%/75%, faster = more points, drawer +60 per guesser), Movie Fibber (write fake plot, vote real one: +200 for real, +100 per player fooled), Who's the Impostor? (one player gets a similar film via dcSimilar, clue laps, vote, caught impostor guesses the film for +150, escaped impostor +300).
- Entry: top-bar Games button (lg), More menu, home card 'Game night with friends'. Realtime eventsPerSecond raised to 20.
- Limits: game state (incl. secret words) is broadcast to all clients, so a technical player could peek in dev tools; no voice; scores not saved.


## v79 - Game night security and robustness rebuild (games.js?v=2)
- Each player makes ECDSA (signing) + ECDH (encryption) P-256 keys in sessionStorage ('gn_keys2'); player id = base32(SHA-256(public signing key))[0:10]; presence entries are signed; every broadcast is {f, d, s} signed, with a per-sender increasing n (replays dropped). Unknown/unsigned senders are ignored.
- Only the host's state is accepted (st.host + st.joined join order; host = first joined player present with screen on; screen off > 6 s or gone > 5 s hands over; returning host does not reclaim). Incoming state is sanitised (gnCleanState). Host heartbeat every 5 s.
- Secrets stay on the host (GN.sec): draw choices/word, fib authors, impostor + films. Players get theirs AES-GCM encrypted (ECDH). A new host restarts the turn/round in progress.
- No player-controlled value is placed in onclick: buttons use data-act/data-v with a delegated handler.
- Drawing: flush every 150 ms, min point distance 0.005, channel self:false. Presence updates debounced (Supabase closes a connection on 'Client presence rate limit exceeded'). Auto-reconnect on CLOSED/ERROR.
- Also: impostor leaving ends the round, fewer than the minimum players ends the game, 5 s grace for drop-outs, Fibber decoy plots (min 4 options), alternative titles + number/roman/'the' matching for guesses, no title words in impostor clues, tie message + 50 pts for spotting the impostor, duplicate names numbered, impostor film from popular pool.
- Known limit: a cheater can still send a fake state to someone who joins after them (before the real host answers).

## v80 - Drawing board upgrade (games.js?v=3)
- Board sizes itself to the space (gnFitBoard: word + clock + tools always visible); chat sits beside the stage from md up, and shrinks to 18vh for the drawer on phones.
- Big round clock (gnClockHtml) with red last 10 s and ticks; WebAudio tones for tick/correct/turn/end with a mute button (localStorage gn_mute).
- Smooth quadratic strokes (new 'e' stroke-end op), brush preview cursor, custom colour picker + size slider (2-40) and S/M/L presets (hidden on phones); colour/size can change mid-stroke (the line continues in the new style); last tool remembered (gn_tool). Shortcuts: Ctrl+Z, B, E, [ ].
- Fix: a host whose page reloads (and asks for the game) is treated as lost; the next player takes over and sends it back.


## v81 - Full product sweep fixes
- Watch together: everything from other devices is validated (wtSafeItem/wtSafeState/wtSafeColor); film ids could previously inject code via onclick.
- Vibe filter used 'has any votes' (matched every title); now the main vibe decides (+ rating >= 8 for Must watch). Vibes with no titles (Skip it, Time pass) hidden from the menu and from Browse by vibe.
- Search chips now open the matching list (they typed 'Robert Downey', 'Movie', 'mind blown' into search).
- syncTopNav kept overwriting responsive classes: Daily showed on tablets and pushed More off the bar; divider hidden below lg.
- Data: scripts/fix_runtimes.mjs replaced 1,724 made-up '2h 10m' runtimes and 35 placeholder directors in the built-in catalogue; DB_VERSION bumped to flush saved copies.
- Daily trending sync no longer replaces complete catalogue entries with thin ones, and new trending titles get real genres and no fake runtime/director.


## v82 - Catalogue depth, original titles, saved sweep
- scripts/add_regional.mjs: +1,034 films in Telugu/Kannada/Marathi/Punjabi/Bengali/Malayalam (vote bar 4) into catalog_extra.json (now 6,088; CAT.v=2). Indian total ~3,534; Telugu 757, Bengali 291, Kannada 145.
- scripts/add_alt_titles.mjs: 'alt' = other names in Latin letters for 3,084 Indian films (1,825 have some, e.g. Laapataa Ladies, DDLJ). Search matches alt; Draw the Movie accepts alt as a correct guess. Note alt includes some foreign-language translations (harmless).
- Placeholder directors blanked (32); unknown runtimes/directors are blank, never invented (filmography fallback fixed).
- tests/product-sweep.js: paste/load in the site and run  await runProductSweep()  at 375/768/1440 widths (needs the file served from the site because the CSP blocks eval). Returns {problems:[],passed:[...]}. DB_VERSION=v9_alt_titles.


## v83 (deployed live 2026-11-20, c73f246): direction C "Marquee" redesign
- New look: black/paper-white, brick orange #D6502F, Anton headings + wordmark, Barlow Condensed 700 poster names (19px, white), no outline on posters. Implemented as an override layer: `theme.css?v=3` after tailwind.css (tablet nav tightened so the top menu fits at 768).
- Netflix-style hover card (desktop mouse only): `hover-card.js?v=2` + `hover-card.css?v=1`, fixed 340x326, Play / add to watchlist / more info, meta line and 3 tags.
- Phone: 44px tap targets, 12px minimum text, first poster row on the first screen (Streaming now moved under the banner).
- Fonts self-hosted: anton, barlow-condensed-600/700 (fraunces removed). New icons/favicon, manifest and theme colour #090909.
- sw.js CACHE_NAME v83, precache updated. Product sweep: problems [] at 375, 768 and 1440.
- Deployed after the user said "ship". Sweep problems [] at 375/768/1440, local and live.

## v84 (deployed live 2026-11-20): tapping the chosen verdict again clears it; deployed
- index.html: vsSetTier calls vsRemoveVote when the already-chosen verdict is tapped again (eeca140).
- sw.js CACHE_NAME v84. games.js?v=4, CAT.v=2, DB_VERSION=v9_alt_titles unchanged (those files did not change).
- Deployed after the user said "ship". Sweep problems [] at 375/768/1440, local and live; live sw cache is v84 only (v83 removed).
- Not tested live: clearing a verdict (needs a signed-in user).
- Open (pre-existing, not from v84): analytics types game_room/game_start/game_conn/daily_done are not in the events.type check in supabase/admin_analytics.sql, so those inserts return 400 and the batch they are in is lost.

## Resume notes (saved 2026-11-20, end of day)
- Live site: v84 (verdict fix) deployed. Live = origin/main at eeca140 plus the deploy; the release commit 12aaabd and the analytics commit c62fe82 are local only.
- BLOCKED: `git push origin main` returns 403 (Permission denied to DebarshiDas007). Fix the GitHub login (Windows Credential Manager), then push 12aaabd and c62fe82.
- Next: apply supabase/admin_analytics_event_types.sql to the live Supabase project (lbtuikgpgcgrizijfiyl) after the user says yes. Then confirm game_room / daily_done events are accepted (no 400).
- Open: the verdict clear animation is instant (no green-to-normal fade); the user may want a fade.
- Open: tester and reviewer reports were not run for v83/v84 changes.
- Not verified live: clearing a verdict (signed-in user), real phones, multi-player game rooms.

## v85 (deployed live 2026-11-20, 7f27f63): header and admin logo match the sign-in wordmark
- index.html header wordmark now uses the sign-in wordmark: WATCH + orange VIBE (#D6502F), Anton, 15px (was 19-22px). theme.css?v=5 drops the old header wordmark override (24px, orange bar). admin.html logo is the same 15px Anton WATCH + orange VIBE (was purple VIBE, 20px).
- tailwind.css rebuilt (the unused old header sizes dropped). sw.js CACHE_NAME v85 (precache theme.css?v=5). games.js?v=4, CAT.v=2, DB_VERSION=v9_alt_titles unchanged (those files did not change).
- Deployed after the user said "ship". Syntax checks passed (both inline scripts, sw.js, games.js, hover-card.js). Sweep problems [] at 375/768/1440, local and live; no sideways scroll. Live header wordmark computed 15px Anton, VIBE rgb(214,80,47), identical to the sign-in wordmark; live admin logo the same. Live sw cache is v85 only (v84 removed). Detail page, a Daily Challenge question and a game room (create, leave) checked live.
- Small difference: admin.html does not load theme.css, so WATCH there is pure white (#FFFFFF) instead of paper white (#FAFAF7).
- Seen during the live check (not from v85): leaving a game room returned to the Daily Challenge view and the next question started its timer without a tap.
- Push: see the commit after this entry (GitHub push was returning 403).

## Resume notes (saved after v85)
- Live site is v85 (already deployed earlier today): verdict fix (v84), sign-in-style logo in header and admin (v85).
- BLOCKED: `git push origin main` returns 403. Local-only commits: 12aaabd, c62fe82, e5e1b53, 7f27f63, 9493732 and this note. Fix the GitHub login, then push.
- Next: apply supabase/admin_analytics_event_types.sql to live Supabase (lbtuikgpgcgrizijfiyl) once the user says yes.
- Open: Daily Challenge timer starts after leaving a game room without a tap.
- Open: verdict clear is instant (no fade).
- Not verified live: clearing a verdict (signed-in user), real phones, multi-player rooms.

## v86 (phone layout): hero and posters scale with the screen; landscape hero is a strip
- theme.css?v=6 (index.html and sw.js precache). sw.js CACHE_NAME watchvibe-cache-v86.
- Phone (max-width 639px): hero min-height clamp(220px, 36svh, 320px); row posters clamp(118px, 38vw, 160px).
- Landscape with max-height 500px: #heroCarousel is 58svh (200 to 300px) instead of the 16:8 tablet ratio.
- Measured before: 320x640 first poster row at y=708; 844x390 landscape hero 418px and first row at y=705.
- After: 375x812 first row y=628 (was 656); 844x390 first row y=513 (still below the fold; the filter bar takes the space).
- Still open: 320x640 first row at y=680 (below the fold); filter bar height is the cause.
- Product sweep: problems [] at 375 and 768 locally (17 passed each).
- Deployed after the user said "ship".

## v87: first poster row visible on short phones and landscape
- theme.css?v=9 (index.html and sw.js precache). sw.js CACHE_NAME watchvibe-cache-v87.
- Short portrait phones (max-height 720px, max-width 639px): hero padding and title art tightened, "Featured" line hidden.
- Very narrow phones (max-width 359px): language and vibe selects share one row.
- Landscape phones (max-height 500px): the hero is hidden so the poster rows come first.
- Measured (first poster top, bottom bar top):
  - 375x667: 538 (was 554 in the first v86 try, 628 at 812 tall before) vs bar 602. Row heading and ~64px of posters visible.
  - 320x640: 538 vs bar 575 (v86: 590). Row heading and about 37px of posters visible.
  - 844x390 landscape: 267 (was 513 in v86, 705 before). Poster row visible.
- Product sweep (local): problems [] at 320, 375 and 768 (17 passed each).
- Deployed after the user said "ship".

## v88: credits are links (cast and director open that person's filmography)
- index.html: `PERSON_SKIP`, `personNorm`, `personNames`, `personLink`, `openPerson(name, role)` and one delegated click handler on `[data-person]` (names go in data attributes via esc(), never in onclick).
- Title page: Director and Cast names are buttons. Clicking closes the title page and opens the actor modal for that person.
- Person page: curated ACTORS profile if the name matches; else a dynamic profile `person-<normalised name>` built from the local catalogue (cast or director match) and filled by `enrichActor` (TMDB person search: photo, bio, birth details, up to 40 titles). Empty About and vibe sections are hidden; empty list says "No titles found for this person yet." Placeholder names (Director, Showrunner, "... Starrer") are never links.
- theme.css?v=11: link style has no underline, text #FAFAF7, orange on hover and focus; 44px tall on phones.
- tests/product-sweep.js: new check "credits open person pages safely" (links exist, a click opens the person page, a hostile name injects nothing).
- sw.js CACHE_NAME watchvibe-cache-v88. tailwind.css rebuilt.
- Not covered: very rare names with no TMDB match show only catalogue films; real-device touch not tested.
- Deployed after the user said "deploy it".

## Database: analytics event types (applied to live Supabase 2026-11-20)
- Applied supabase/admin_analytics_event_types.sql to project lbtuikgpgcgrizijfiyl as migration `events_allow_game_and_daily_types`.
- `events_type_check` on public.events now allows game_room, game_start, game_conn and daily_done (21 types in all).
- Verified: the constraint definition lists all 21 types; a test insert of the four new types succeeded inside a block that rolled itself back; no test rows were left.
- Closes the open item: those events were previously rejected with a 400. Events sent from now on are stored.

## v89: watchlist bug fixed (films came back after remove and refresh)
- Cause: one film could be saved under two ids (catalogue id and TMDB id from search). Removing one card removed only that id, so the other copy stayed in Want to watch and came back on refresh.
- index.html: `wlKey` (the film, by TMDB id or catalogue tmdbId), `wlHas`, `wlRemoveFilm`, `wlDedupe`. toggleWatchlist, toggleWatched and libMirrorWatched remove every copy; saveWatchlistStore dedupes.
- Startup: setLoggedOutUser always reloads the guest copy (`loadUserWatchlistStore(hadSession)`), so the saved list is not wiped at page start.
- sw.js CACHE_NAME watchvibe-cache-v89.
- Tested locally: duplicate pair merged and removed together; add survives reload; remove survives reload; sweep problems [] at 375, 798 and desktop (18 checks each).
- Not tested: the signed-in cloud sync path (needs a signed-in user).
- Deployed after the user said "yes".

## v90: watchlist removal after sign-out (cloud copy kept the removed film)
- Cause: the cloud save waited 600 ms. A removal followed quickly by sign-out never reached the cloud. The next sign-in then showed the old cloud copy's films again.
- index.html: `flushUserDataToSupabaseCloud()` writes now. The 600 ms timer calls it. `userSignOut()` calls it before Supabase sign-out. A `visibilitychange` (page hidden) listener also calls it.
- sw.js CACHE_NAME watchvibe-cache-v90.
- Tested locally with a stand-in cloud table: remove then sign out at once -> cloud updated -> sign in shows the right list. Sweep problems [] at 375, 798 and desktop (18 checks each).
- Not tested against the real Supabase table; the signed-in flow still needs a check on the live site.
- Deployed after the user asked to deploy autonomously.

## v91: search bar typing lag fixed
- Cause: every keystroke ran the full search and redrew all matching titles at once. A one-letter query matched thousands of films and took up to 460 ms on desktop, far longer on phones, so the typed letters appeared seconds late.
- index.html: `queueUniversalSearch` runs the search 120 ms after the last keystroke (the box still updates at once). The title grid shows the first 48 results and the People list the first 24; the true title count stays in the heading, with a note when results are cut.
- Measured locally: one-letter search 14-24 ms (was 462 ms for "b"). No long tasks while typing.
- Sweep problems [] at 375, 768 and 1440 (18 checks each).
- sw.js CACHE_NAME watchvibe-cache-v91.
- Deployed after the user asked for autonomous deployment.

## v93: title-window animation and design pass
- Title window opens like Netflix's more-info panel (theme.css `dmBackdrop` and `dmGrow`, `playDetailsEnter` in index.html): the backdrop fades in and the window grows out of the tapped poster. Closing is unchanged. Respects reduced motion.
- Design pass (from the taste review):
  - Home: the hero comes first; the language and vibe filters sit below it.
  - Daily Challenge "Play now" and Game night "Start a room" buttons are outlined; orange stays on each screen's main action.
  - admin.html loads theme.css?v=13 (black ground, orange accent).
  - Header wordmark 19px from 1100px wide; 15px below.
  - `#previewSlot iframe { pointer-events: none }` so YouTube's own controls do not show over the trailer.
- theme.css?v=13. sw.js CACHE_NAME watchvibe-cache-v93 (v92 was never set).
- Sweep problems [] at 375, 768 and 1440 (18 checks each). Phone first poster row at 375x667 still y=538.
- Not verified: the YouTube pause icon on the live site; signed-in admin screens.
- Not done from the review: larger poster meta text; single typeface idea.
- Deployed after the user said "Deploy".

## v94: phone fixes (from a real phone screenshot)
- Logo: 24px on phones (theme.css, max-width 767px). Desktop 19px from 1100px, 15px between.
- Games: a gamepad button in the header on phones (`#headerGamesBtn`, md:hidden) and a "Games" chip in the tab row (`mobileTabs`). Tab chips are tighter (px-2.5, 13px) so all five fit at 390px.
- Featured banner: the mute and pause buttons are 32px round buttons at the top right on phones (they were 44px squares at the bottom right, on top of the title). Desktop unchanged.
- Trailer: a "Trailer" button next to View details on touch screens (`data-hero-trailer`, shown by `(hover: none) and (pointer: coarse)`), `heroPlayTrailer()`. It plays the trailer on tap even when data saver or reduced motion is on (`startTrailerPreview` takes `force`), holds the carousel and shows the volume button; "No trailer found for this title." if none. Cause of the silent non-start: the automatic start is blocked by data saver, reduced motion, 2g/3g or low memory, with no message.
- Filters on phones: language and vibe side by side, sort below, reset under (`.wv-filters`, `.wv-toolbar`, `.wv-sort`). After a language or vibe change the page scrolls so the filters stay in view (`wvToFilters`; the banner disappears and the page used to jump).
- Title window on phones: "Where to watch" (max 300px) and "How did it feel?" (max 250px) fold with a "Show ..." button (`dmCollapsePhones`, `.dm-collapsible`, `.dm-more`). Interstellar at 390x844: 3.3 screens down to 2.3.
- theme.css?v=14 (index.html, admin.html, sw.js precache). sw.js CACHE_NAME watchvibe-cache-v94.
- Sweep problems [] at 390, 768 and 1440 (18 checks each).
- Not verified: the trailer playing on a real phone (the test pane counts as a hidden page; only the button path was run); signed-in flows.
- Deployed after the user reported the issues with a screenshot.

## v95 and v96: watchlist removals that stick, banner, trailer
- ROOT CAUSE of "removed films come back after sign out and sign in": syncing combined the two lists (this copy plus the cloud) when this device had no change time, and a copy that still held a removed film put it back and then saved it into the cloud. Nothing recorded that a film was removed. The earlier v90 fix (flush before sign-out) did not touch this.
- Fix: each film's last add and last removal are stored with their time (`userWatchlistAdded/Removed`, `userWatchedAdded/Removed`; keys are `wlKey(id)` for the watchlist, the film id for watched). `stampMerge` and `stampKeeps` merge them: a film stays removed unless it was added again after the removal. Stored locally (`_wl_added`, `_wl_removed`, `_wh_added`, `_wh_removed`) and in the cloud payload (`watchlist_added`, `watchlist_removed`, `watched_added`, `watched_removed`). Removal stamps older than 365 days are dropped; at most 600 per map. `persistWatchlistLocal(touch)` saves without bumping the change time when a merge only read the cloud. Cloud save failures are now logged and retried (3 times).
- Tested with a stand-in cloud: device A adds four films and removes two; a second device with an old copy of all four signs in: the two stay removed and the cloud keeps its list. Re-adding after a removal works and survives sign-out and sign-in. An old cloud copy with no removal records cannot bring back a film removed on this device.
- Existing films already back in a list have no removal record yet: removing them once more records it.
- Banner (phones, below 768px): no View details or Trailer buttons; tap the picture to open the film (`.hero-slide` has the click). Tablet and desktop keep View details (`hidden md:flex`).
- Trailer reveal: some phones ignore the 16 s start. The picture used to stay hidden until the video reached 16 s, longer than the banner stays on one film. It now seeks once to the highlight and shows after 2.5 s of playing. Player load wait: 14 s (muted), 40 handshake tries.
- YouTube header bar over the trailer on phones: the player is zoomed 1.6x (desktop 1.25x) and at least 17% of its height is cut at the top.
- theme.css?v=15; sw.js CACHE_NAME watchvibe-cache-v96.
- Sweep problems [] at 390, 768 and 1440.
- Not verified: the trailer on a real phone; sign-in against the real database (needs a signed-in user).

## v97: phone layout, one Games option
- Featured banner on phones is taller: `.hero-slide` min-height clamp(260px, 44svh, 400px) (was 220 to 320); 371px at 390x844 (was 304). Short phones (max-height 720px): clamp(190px, 31svh, 240px), 207px at 375x667; first poster row still clear of the bottom bar (y=524, bar 602).
- Filters (language and vibe) sit lower: 28px under the banner and 30px above "Streaming now" (the gap below them was about 100px): `div.space-y-5 > #wvFilterBar { margin-top: 28px; margin-bottom: -26px }` on phones only.
- One Games option on phones: the gamepad button in the header (`#headerGamesBtn`). The "Games" chip is removed from the tab row (`mobileTabs`), whose chips are back to px-4 / text-sm; four chips fit. Desktop is unchanged (its own Games nav item; header button is md:hidden).
- theme.css?v=17; sw.js CACHE_NAME watchvibe-cache-v97. Sweep problems [] at 390, 768 and 1440. Desktop hero 546px, unchanged.
- Deployed after the user asked for these changes with a phone screenshot.

## v98: "Marquee, refined" redesign (desktop and phone)
- Built from the Design canvas "WatchVibe Redesign: Marquee, refined". theme.css v18 appends a new layer (soft 8/12px radii, pill chips, Barlow Condensed sentence-case headings, tokens bg #0A0A0B / surface #141418 / line #26262C).
- Header: text nav, search pill with "/" hint from 1100px, avatar-only profile button, 68px bar. Watchlist and Games labels show from lg.
- Hero: rating chip, certificate, synopsis (768px+), Play trailer (`heroPlayTrailer`), Watchlist toggle (`heroWl`), More info (desktop only). Segment bar and arrows along the bottom on desktop; on phones a rounded card with the progress bar on top and Play trailer plus "+" only. Tapping the picture still opens the film.
- Mood chips under the banner (`.wv-moodrow`, phone copy `.wv-moodphone` scrolls above it); matches render under the chips (`#aiVibeResultsSection` moved into `.wv-top`). Language and vibe selects sit beside the chips on desktop.
- Posters (`posterCard`): rating chip on the picture, one-line title, coloured mood tag plus year and genre.
- Phone Games: still one option, the header gamepad.
- sw.js CACHE_NAME watchvibe-cache-v98. Sweep problems [] at 390, 768, 1440.
- Not done: "Under 2h" chip; phone bottom bar keeps orange icons.

## v99: bigger WatchVibe wordmark (today's progress)
- Header wordmark top left is larger: 28px on phones (was 22), 30px on tablets (was 22), 36px from 1100px (was 24). theme.css?v=19, sw.js CACHE_NAME watchvibe-cache-v99. Checked live at 1024px: no overflow in the nav or page.
- Today in short: v98 "Marquee, refined" redesign (desktop and phone) shipped and pushed (commit 43a53b4); v99 wordmark size.
- Open: the phone hero keeps Play trailer and "+" buttons from the design (earlier request was to remove them; user can ask to drop them); no "Under 2h" chip; phone bottom bar icons are still orange; revoke the exposed GitHub tokens; the four stale watchlist films (Interstellar, Breaking Bad, Parasite, Stranger Things) need removing once more.

## v101: hover card and poster ratings match (urgent fix)
- Bug: the hover card showed the TMDB/local score (e.g. The Godfather 8.7) while the poster showed the IMDb rating (9.2). Hover card now uses the same IMDb number (window.wvImdbRating in index.html) and loads it when opened; blank until IMDb has loaded, never a TMDB number.
- Posters that were waiting for a TMDB match (data-rtl) now fill in as soon as their IMDb rating arrives, so a poster no longer stays blank while the hover card shows a number.
- Files: index.html (imdbApply, wvImdbRating, wvImdbEnsure; hover-card.js?v=3), hover-card.js, sw.js CACHE_NAME watchvibe-cache-v101.
- Checked live: syntax OK; product sweep problems [] at 375, 768 and 1440; hover card and poster ratings matched on every title sampled (the rest were blank on both sides until IMDb loaded).
- Not done: a poster whose IMDb rating has not loaded yet stays blank until it does, by design.

## v102: one profile control (account menu)
- Desktop had two profile icons (the "Profile" nav item and the avatar button). The nav item (`#desk-tab-profile`) is removed; the avatar button (`#cloudAuthBtn`) now opens an account menu (`toggleAccountMenu`, `closeAccountMenu`, styles `.wv-acct*` in theme.css).
- Menu: avatar, name, email (Guest: "Sign in to sync across devices"), vibe persona chip once something is watched, Watchlist and Watched counts, rows for Your profile, Watchlist, Taste Match, Daily Challenge, and Sign out or Sign in or create account. Closes on outside click and Escape; focus moves into the menu.
- Phones: the header avatar is hidden (the bottom bar already has Profile, which holds the sign-in button), so there is one profile control at every width.
- theme.css?v=20, sw.js CACHE_NAME watchvibe-cache-v102 (v101 was the hover-card rating fix from another session). Sweep problems [] at 390 and 1440; syntax check passes. Checked live: menu opens, no Profile nav item.
- Not verified: the menu with a real signed-in account (tested with a stand-in session); the taste-skill design tools were not run, the menu follows the v98 design tokens.

## v103: one vibe picker, better matcher, real Trending stars
- ONE vibe picker: the mood chips under the banner (+ "Under 2h" chip) and a describe field (`#aiVibeInput`, `.wv-describe`) replace three places (chips, the "What are you in the mood for?" card, and the Vibe select in the filter bar). Matches open straight under the chips. The Vibe select is gone (language select stays); `setTopVibe` and `browseVibe` still exist for links.
- New matcher (`runAiVibeMatcher`, `aiMoodFit`, `AI_MOODS` profiles, `AI_MOOD_HINTS`): each mood has genres that fit and spoil it (a first-listed genre counts more), plot words, a rating floor and the title's own vibe tag. Several moods must all fit (geometric mean). Typed text adds title/cast/director/genre matches and TF-IDF plot similarity (`synVec`/`synCos`), and words like "cry" or "funny" switch on a mood. Quality = vote-weighted rating. Watched films are left out, `userTaste()` nudges the order, and the final eight are varied (one per franchise, at most four of one lead genre). It no longer uses the placeholder vote splits. Runtime-only ("Under 2h") works too. Checked by listing results for each mood, mood pairs, and typed requests (cozy rainy night, nolan).
- Trending stars (`starsInner`, `hydrateStars`): real, from TMDB trending and popular people, only actors who have films in our catalogue, cached per day (`watchvibe_stars_v2`); falls back to the lead actors of recent, well-voted catalogue films. Cards open the real profile (`data-person`, `openPerson`). The old hard-coded ACTORS stats (box office, "hype") are no longer shown on the home page.
- theme.css?v=21, sw.js CACHE_NAME watchvibe-cache-v103. Sweep problems [] at 390, 768, 1440; syntax check passes.
- Not done: the phone hero buttons question, orange bottom-bar icons, token revoke, four stale watchlist films. Not verified: matcher quality on real users' taste (tested without watch history).

## v104: mood pages (a full page of films per mood, from TMDB)
- Clicking a mood chip (or typing in "Or describe it", or "Under 2h") opens a MOOD PAGE: nothing else on it (no banner, rows, stars or cards), just the chips, the describe field, the language select, a heading and a grid of 60 films, with "Show more films" adding 60 more. Code: `openMoodPage`, `mpLoad`, `mpFetchState`, `mpUrl`, `moodPageHtml`, `MOOD_SRC`, `MP` state. "All moods", Home and the category tabs return to the home page.
- The films come from TMDB's own catalogue (discover by genre and story keywords, best audience rating first with a vote floor), NOT from WatchVibe votes. Each mood in `MOOD_SRC` has an ordered list of sources, strict first (e.g. cry: Drama tagged tearjerker, grief, terminal illness, death of a loved one, heartbreak, loss of loved one, leaving out action, crime, comedy, sci-fi, horror), then broader ones, so the page keeps going. Keyword ids are looked up once with TMDB's keyword search and cached (`watchvibe_kw_v1`). Several moods are interleaved. The language select and "Under 2h" (`with_runtime.lte=120`) apply.
- Typed text: words like cry or funny switch on moods (`AI_MOOD_HINTS`); other text searches by keyword and TMDB title search.
- Films not in the catalogue are built from the TMDB row and registered in `DYNAMIC_MEDIA` (id `tmdb-m-<id>`, same as the featured picks); the poster shows the IMDb rating when it loads.
- If TMDB cannot be reached, the page falls back to the local matcher (`runLocalVibeMatcher`, up to 60) and says so.
- Header wordmark is larger (28px phone, 30px tablet, 36px at 1100px+) was v99.
- theme.css?v=22, sw.js CACHE_NAME watchvibe-cache-v104. Sweep problems [] at 390, 768, 1440; mood page has no sideways scroll at 390.
- Not verified: the page for the Indian-film mood mix (results are global unless a language is chosen); TMDB rate limits under heavy use.

## v105: mood filter redesign (one mood at a time)
- Audit finding: several moods at once did not combine, they interleaved unrelated films (all six gave 328 mixed titles; cry + laugh alternated sad and funny). The describe box found 1 film for "something with dinosaurs" and duplicated the header search. Both are gone.
- ONE mood at a time: `toggleAiMood` selects a mood, tapping the chosen one clears it (the chip shows an x). No "All moods" chip. "Under 2h" is a modifier (it also works alone: "Films under 2 hours").
- Mood page toolbar (sticky under the header): mood chips; second row Movies | Series toggle, Under 2h (movies only), language select, sort (Top rated, Newest, Most popular). Each mood has a one-line description, a film count, and films load as you scroll (IntersectionObserver on `#mpSentinel`, plus a "Show more" button).
- Series: `MOOD_TV` holds TMDB's TV genre sources (TV has no Romance/Thriller/Horror genres); items get ids `tmdb-tv-<id>`, type Series.
- Address: `#mood=cry&type=series&sort=new&lang=hi&rt=1` (`mpHash`, `mpPush`, `mpFromHash`; popstate and load). Back, refresh and shared links work; clearing the mood returns to the home page and the hash goes away. Auth error hashes are untouched (they use `#error=`).
- Remembered per visit: `MP_CACHE` (24 pages) makes reopening a mood instant (35 ms measured). Keyword ids stay cached in `watchvibe_kw_v1`.
- The home page keeps one chip row (moods + Under 2h) and the language select. The phone mood pills scroll sideways.
- theme.css?v=23, sw.js CACHE_NAME watchvibe-cache-v105. Sweep problems [] at 390, 768, 1440; mood page has no sideways scroll at 390, 768, 1440.
- Not verified: series quality for every mood (TV discover returns fewer strict matches); the Newest sort on series with a high vote floor starts at 2024.

## v106: Daily Challenge showed the wrong film after a missed "which came out first?" question
- Bug: in the "Which of these films came out first?" question (kind `year`) the correct option is the earliest of four films, but the result picture, poster and title always showed the film the round was built from, which is one of the other (incorrect) options. In all 6 such questions across the three levels the two differed (e.g. asked Forrest Gump, correct answer Romancing the Stone).
- Fix in `renderDaily`: for kind `year`, once the question is done the result shows the correct option's film (`ans`, looked up by the option's new `id` from `dcBuild`). Other kinds were checked: scene, zoom, cast, plot (the shown film is the answer), director and lead (the shown film is the subject, and the correct name is printed as "answer: ...").
- Checked the other games in games.js: Draw the Movie reveals the drawer's word, Movie Fibber always shows the real film, Who's the Impostor shows both films with labels. No change needed.
- Verified by building all year questions (6 of 6 differ) and rendering a missed one: the page now has the correct film's backdrop and title and not the asked film's. Sweep problems [] at 798 px wide pane.
- sw.js CACHE_NAME watchvibe-cache-v106 (theme.css stays v23).

## v107: home shelves (Netflix-style rows, a much longer home page)
- Problem: the home page had only three category rows (Indian cinema, Series, Stand-up) of 14 to 16 titles, then the stars row and the end.
- Now 20+ shelves built from the whole catalogue by rules (`HOME_DEFS`, `buildHomeRows`, ~50 ms): Top 10 films right now (numbered), Streaming now, Picked for you (only after 3+ saved or watched titles, uses `userTaste`), New releases, Bollywood blockbusters, South Indian cinema, Browse by genre (tiles), Critically acclaimed, Mind-bending thrillers, Laugh-out-loud comedies, Tearjerkers, Edge-of-your-seat action, Sci-fi and fantasy, Crime and mystery, Family and animation, Romance, Hidden gems, Korean cinema, Anime, Series worth bingeing, Horror, True stories and history, Regional (if enough), Quick watches, Timeless classics, World cinema, Stand-up. Each shelf holds up to 40 titles (was 14 to 16) and "See all" opens up to 400 in the grid view (`HOME_ROWS.byKey`; genre tiles open `genre:<Name>` lists). A title appears in at most two shelves. Page height about 13,900 px at 1440 (was about 3,000).
- Design (taste skill principles: one system, three card shapes, quiet motion): poster shelves, wide backdrop shelves (New releases, South Indian, Tearjerkers, Crime, Hidden gems, True stories), and a numbered Top 10 with outlined numerals. Row header with a quiet "See all >" link, Netflix-style side arrows that appear on hover only when there is more to scroll (`shelfArrows`, desktop pointers only), a fade at the right edge, snap scrolling, genre tiles that use a real backdrop of each genre's best film. The Daily Challenge and Game night cards sit between shelves so the page is not one long wall of posters. Reduced motion respected.
- Efficiency: the first four shelves render at once, the rest as they near the viewport (`initLazyShelves`, IntersectionObserver, rootMargin 1400px; placeholders `.wv-lazy`; the cached home page re-arms it). Posters and backdrops are lazy and use smaller sizes (w342 posters, w780 backdrops).
- Shelf rules are in `HOME_DEFS` (filter `f`, score `sc`, `fmt`). To add a shelf, add an entry and put its key in the order list in `homeShelvesHtml`.
- theme.css?v=24, sw.js CACHE_NAME watchvibe-cache-v107. Sweep problems [] at 390, 768, 1440.
- Not verified: the Picked-for-you shelf with a real history (tested without one); hover arrows on a real touch-and-mouse laptop.

## v108: phone audit (Galaxy S25, 360 x 780) and fixes
- Method: every page (home, mood page movies and series, Explore, Watchlist, Profile, Taste Match, Daily intro and question, title window top and bottom, sign-in, Vibe Deck, Game night) checked at 360x780 with a script (sideways overflow, tap targets under 40 px, text under 12 px, broken images, vertical gaps) plus a screenshot of each. Then product sweep at 320, 360, 390, 412, 768, 1440: problems [].
- FIXED
  - Featured banner picture was almost hidden on phones: a side gradient and a heavy bottom gradient covered a narrow card. The side gradient is off on phones and the bottom one is lighter (text shadow keeps the title readable).
  - Trending stars were squashed (photos not round, names overlapping) on phones: the credit-link rule `button[data-person]` (inline-flex, 44 px) also hit the star cards. Star cards have class `wv-star` and keep their block layout.
  - Home: the language select sat alone in half a row; now full width.
  - Touch targets: chips and the All/Movies/Series tabs 40 px, Movies/Series switch 40, hero mute and pause 40, progress bars have a 36 px hit area, "See all" 40, footer links padded.
  - Text: nothing under 12 px any more (card tags and year lines were 11 px, about 260 elements per page). Poster titles may use two lines so long names read in full.
  - Mood page: only the mood chips stay under the header while scrolling (the three-row bar took a quarter of the screen); the filters scroll away.
  - Title window: cast and director names have a 40 px touch area without tall gaps, shown as a wrapping row without stray commas (`.wv-credits`, `.wv-sep`).
  - Explore: "Browse by vibe" (five tiles, one alone on the last row) is now "Browse by mood" with the six moods, opening the mood pages; the vibe-tag chips (Mind-blowing, Must watch, Emotional) are removed from the pills; its Trending stars now use the real list (`starsInner`) instead of the old fixed actors; the search box text is shorter ("Search films, series, people") so it is not cut off.
- NOT FIXED (decide next)
  - Taste Match, Watch together and Daily have no link in the phone bottom bar (reachable from the home cards and the desktop menu only).
  - The Vibe Deck buttons use their own red, green, orange and teal tints and "Want to watch" wraps to two lines.
  - The sign-in sheet's Discord button is blue-purple (brand colour of Discord).
  - The title window sheet leaves the page header faintly visible above it.
  - Top 10 numerals are partly covered by the poster on a 360 px screen.
- theme.css?v=25, sw.js CACHE_NAME watchvibe-cache-v108.

## v109: "Wall and Index" redesign, light/dark
- New `swiss.css?v=2` (after theme.css): Switzer + IBM Plex Mono, square hairline look, blue accent, tokens for dark and light (`html[data-theme]`, stored as `wv_theme`, header sun/moon button, default dark).
- Home top: Tonight's poster wall (numbered snap posters, arrows, progress bar) with a Now showing panel (Play trailer opens the title window, which starts the trailer; Open film; Watchlist). Mood chips re-sort the wall live; "All ... films" opens that mood's full page. Under 2h filters the wall. Featured daily picks still lead the wall. Old hero carousel code kept but not mounted.
- Everything else unchanged: shelves, Top 10, mood pages (#mood=), language filter, watchlist, daily, games, stars, account menu. theme.css hard-coded dark colours now follow variables.
- Checked: product sweep problems [] at 375/768/1440 (dark) and 375 (light). sw.js cache v109, swiss.css precached.

## v110: wall look "Clean" is now the home look
- Poster wall: Clean look (small label, title + Play trailer + Watchlist, much bigger posters, moods under the wall, language select beside the chips on wide screens). Tighter gaps between shelves. `?wall=now|glow|stage|clean` shows the other looks with a demo switch (not linked anywhere).
- Top menu keeps icons only between 1500 and 1799 px (mono caps were too wide). swiss.css?v=10, cache v110.
- Checked: product sweep problems [] at 1900/1600/1440/768/375 (dark) and 375 (light).

## v111: wall demo switch removed, posters sized to the screen
- Removed the ?wall= demo switch and the Glow, Stage and old looks (JS and CSS). `<html data-wall="clean">` is fixed. swiss.css?v=12, cache v111.
- Poster width = min(17vw, (100vh - 250px) / 1.5), 200-380 px: whole poster, title and chips fit on the first screen at any desktop size.

## v112: Cabinet Grotesk headlines + motion
- Fonts: Cabinet Grotesk 700/800 (Fontshare, free licence) for headlines, poster names, wordmark; Switzer stays for body, Plex Mono for labels.
- Motion (all off for prefers-reduced-motion): title and facts rise into place when the film in front changes; posters arrive one by one; mouse-only poster tilt with a light; chip colour sweep on hover; shelves fade up on scroll (scroll-driven, no JS). swiss.css?v=13, cache v112.
- Checked: product sweep problems [] at 1864 and 375.

## v113: Daily and Game night redesign, Top 10 in poster size, bigger wall heading
- Daily challenge: full-width Swiss layout (huge headline, count-up stats, numbered level cards with progress line, boards below); in-round and result pages get the same header/stat style and wider column.
- Game night lobby: two columns (headline + name/room form, three numbered game cards). games.js?v=5.
- Posters now come in two formats: portrait 2:3 and wide 16:9. Top 10 uses the portrait size with the rank on the picture (top10Card kept but unused).
- "Tonight's poster wall." heading is a large Cabinet Grotesk headline. swiss.css?v=16, cache v113.
- Checked: product sweep problems [] at 1864, 1500, 768, 375.

## v114: Vibe Deck removed, Watchlist redesign, bolder Home/Movies/Series/Stand-Up
- Removed the Vibe Deck (swipe cards) completely: header button, phone bottom-bar Swipe button, "More" menu item, modal, functions, the S shortcut. (Taste Match keeps its own swipe flow.)
- Watchlist page (Want to watch, Watched, My reviews): new header with a huge title and the three sections as big counter tabs, hairline controls, posters in an auto-fill grid with 01, 02... numbers, bigger titles, square buttons, Swiss rows for list view and reviews, new taste panel and empty states.
- Home / Movies / Series / Stand-Up: 14px bold in the top bar (from 1100 px), 46px high bold segmented control on phones.
- Light mode: body text colour fix (unclassed text stayed light), level tag colours. swiss.css?v=18, cache v114.
- Checked: product sweep problems [] at 1864, 1500, 768, 375; a full Daily round played to the result page.

## v115: Watchlist tabs fix
- Bug: with an empty watchlist the "Start with these" row stretched the page grid, pushing the Want to watch / Watched tabs off screen to the right on wide screens. Fixed with minmax(0,1fr) tracks (watchlist and Daily).
- "My reviews" tab is now always visible; signed-out it shows a Sign in message. swiss.css?v=19, cache v115.

## v116: top-bar navigation fixes + film window redesign
- Movies / Series / Stand-Up now switch to the home page first (they only redrew the current page, so on Watchlist, Daily, Explore... nothing changed).
- Game night opens below the top bar (#gnRoot top 68px / 56px on phones) so the top tabs stay reachable. Using the top bar while it is open leaves the lobby; inside a live room it asks "Leave this game room?" first (gnGuard in goHome, setTopCategory, switchTab).
- Film window (title details): wide two-column layout (actions, where to watch, synopsis, verdict and reviews | poster and facts), big Cabinet Grotesk title over the trailer, square buttons, "More like this" below. Same ids, so trailer, availability, verdicts and reviews code is unchanged. swiss.css?v=20, cache v116.
- Checked: product sweep problems [] at 1864, 1500, 768, 375; navigation clicks from Watchlist, Daily and Game night.

## v119: film window shows the whole trailer
- The title no longer sits on top of the trailer: the trailer is a full 16:9 picture (width capped so it fits the window height), the title, logo and facts sit in a dark band below it. The player is only zoomed 7 percent (data-fit) instead of 25 percent plus a 17 percent top crop, so nothing important is cut. Applies to every title. swiss.css?v=23, cache v119.

## v120: security hardening
- Database (Supabase, applied as migrations security_admin_check_server_side and security_events_limit_grants_search_path): is_admin() now checks the signed-in user's confirmed email in auth.users against public.admins (no longer trusts user_metadata); profiles admin policy uses is_admin(); events table: per-session limit of 120 inserts a minute and 2,000 a minute overall (trigger events_rate_limit); trigger helper functions and admin tools no longer callable by anonymous visitors; daily_submit signed-in only; search_path pinned. Tested: admin true, ordinary user false even with forged user_metadata, forged token false, limiter stops at 120, review link guard still runs.
- OMDb key moved out of the code into the Cloudflare Pages secret OMDB_KEY (functions/api/imdb.js has no fallback). The old key is still in Git history, so replace it with a new key: `wrangler pages secret put OMDB_KEY --project-name watchvibe`.
- _headers: HSTS 2 years with subdomains, COOP same-origin-allow-popups, more Permissions-Policy items, X-Permitted-Cross-Domain-Policies.
- DEPLOY_GUIDE.md moved from the public folder to docs/. Debug console.log calls removed (index.html, sw.js). Cache v120.

## v121: API rate limits (replaces the first, leaky cache-based counter)
- Each /api function now asks api_rate_hit() in Supabase (atomic, shared) before it spends upstream quota: imdb 120 lookups a minute per visitor, links 40, featured 12; cache hits are free. Over the limit gives 429 with Retry-After. The visitor's IP is only stored as a salted hash (salt = Pages secret RATE_SECRET; same value in table app_secrets, which nobody can read through the API). If the counter is down the request is allowed.
- functions/_middleware.js now only refuses non-GET methods (405).
- Tables api_hits and app_secrets have row-level security with no policies; old rows are cleaned up by the function itself.
## OMDb key replaced
- The OMDb key in the OMDB_KEY secret is a new one (requested from a new mailbox and activated). The old key is no longer used by the site; it is still in Git history and OMDb cannot revoke keys, so it stays usable by anyone who finds it.

## v122: filters that combine (genre, era, language, mood, type, runtime, sort)
- Filter page: new Genre and Era selects next to Language and Sort; every filter narrows the same TMDB list, with or without a mood (genre-only, language-only, era-only pages work). Era options: decades, before 1950, 1950s and 1960s, 1970s and 1980s, before 1980. Older films and non-English films get a lower vote minimum so the list is not empty. Address keeps all of it (#genre=drama&era=c5060&lang=bn). Clear all button; friendlier empty message.
- Home filter bar also has Genre and Era (they open the filter page). Series list only genres TMDB has for TV.
- Tested: Drama + Bengali + 1950s and 1960s (Satyajit Ray classics), Action + top rated, Cry + Romance + under 2h, adding a mood on top, series switch, hash restore. swiss.css?v=26, cache v121.

## v123: filters fix (wrong-language results, vanishing mood chips)
- Bug: when a mood was too strict for the other filters (e.g. Cozy + Comedy + 2020s + Hindi) the page found nothing and silently switched to WatchVibe's own catalogue, which ignored language, genre and era (English films under a Hindi filter). Now: a mood that is too strict is widened with its own exclusions plus the other filters; "nothing matches" is shown as such; the local catalogue is used only when TMDB cannot be reached and then it is narrowed by every filter.
- Bug: picking a language from the home page opened the old plain grid, so the mood chips vanished. A language alone now opens the filter page (chips, genre, era, language, sort all stay). The Movies/Series/Stand-Up list also shows the mood chips; a mood picked from Series stays on series.
- Tested a matrix (Cozy+Comedy+2020s+Hindi: 53 Hindi films from 2020 on; Cry+Hindi; Laugh+Bengali+1990s; Hype+Action+Korean; Drama+Bengali+50s/60s; Tamil only; an impossible mix shows no-results). swiss.css?v=27, cache v122.

## v124: leaner, smarter filters
- Era is now five short choices (2020s, 2010s, 2000s, 80s and 90s, Before 1980); old addresses with the long list still open the nearest choice. Sort is two choices (Top rated, Most popular): Newest is what the era filter is for.
- Filters that lead nowhere are not offered: on the filter page every genre, era, language and mood is checked against TMDB with a quick count under the other filters in use, and the ones that would give no films are hidden (the chosen one always stays). If TMDB cannot be reached every option stays. Counts are remembered for the visit.
- Tested: Bengali only, Korean before 1980, Telugu + Western, Hype + Romance + before 1980 (hidden options match the empty combinations); sweeps clean at 1864/1500/768/375. swiss.css?v=28, cache v123.

## v125: faster film window, pages match the Swiss look
- Film window opens faster: backdrop 0.12 s, card 0.22 s, staggered head/actions (Animation Dictionary style); the poster, backdrop, providers and extras are warmed when the mouse rests on a card (90 ms) or on touch-down (`warmTitle`).
- Taste Match, Profile and Explore rebuilt in the Swiss style (dcl header, hairline cards, square buttons, mood tiles); square buttons, toast and dialogs everywhere (`swiss.css` page-sync block).
- Filter bar overlap onto the mood chips now only at 1800 px and wider.
- Known: at ~1300 px the top menu scrolls inside its own bar (labels collapse to icons); not fixed.
- swiss.css v30, sw cache v125.

## v126: trailer fills the film window
- No black edges: the player is scaled 1.34x to cover the frame, cropped evenly; frame is full width (max height viewport-170px). swiss.css v31, cache v126.

