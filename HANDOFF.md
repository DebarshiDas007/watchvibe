# 🎬 WatchVibe — Project Handoff

> Read this file (and `memory/HANDOFF.md` for product/stack background) at the start of every session.

## 1. Overview

| | |
| :-- | :-- |
| Product | Movie/TV discovery PWA with "vibe" ratings |
| Live | https://watchvibe-b92.pages.dev/ (Cloudflare Pages — the only hosting target) |
| Repo | https://github.com/DebarshiDas007/watchvibe (`main`) |
| Root | `D:\watchvibe` |
| Shipped app | `web_live_build/index.html` (single-file SPA/PWA) |
| Flutter port | `lib/` — **experimental, not buildable yet** (platform folders are stubs, no tests, `dart:io` blocks web). Treat as a prototype. |

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
- Service worker cache is at v28; bump it on every deploy.

## 6. Testing

 - **Where to watch** is live per-region data from TMDB (JustWatch), fetched when a title opens. The old embedded per-title streaming/ottPlatform fields were fabricated and have been removed. Region = user choice > Cloudflare /cdn-cgi/trace (real IP country) > ipapi.co > country.is > time zone. tests/ott-audit.js (await runOttAudit()) checks every title x 15 regions (no phantom or dropped services, valid links). Providers are normalised in tidyProvider(); per-service links are built in buildProviderLink() (unknown services fall back to the TMDB/JustWatch page for the region).
- Paste 	ests/content-sweep.js into the browser console on the site: renders every title (details window + card) and ~1,000 home/filter views and reports errors, bad text and missing fields. Last run (Nov 2026): 2,059 titles, 1,032 views, 0 errors; 4,118/4,118 poster+backdrop images load; 1,920/2,059 titles have a TMDB trailer (the other 139 show the backdrop only).

## 7. Known gaps / roadmap

- Admin Studio analytics are local-only (localStorage); only the user list comes from Supabase (`profiles`, admin-only via RLS).
- Watchlist cloud merge is union-only (removals on one device don't propagate).
- `index.html` is ~5k lines of inline JS/CSS; split into modules with a build step when practical. Many `innerHTML` templates still interpolate TMDB strings — use `esc()` for any new/changed template.
- `media_database.json` (4 MB) is not fetched by the app; remove or wire it in.
- Flutter port: finish or delete.
- Add real PWA icons (manifest currently points to Unsplash photos).
