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
- Service worker (`sw.js`) never caches TMDB/Supabase/geo API calls.

## 3. Operations

```powershell
python D:\watchvibe\deploy.py            # deploy to Cloudflare Pages (needs CLOUDFLARE_API_TOKEN, wrangler)
cd D:\watchvibe\web_live_build; python -m http.server 8080   # local preview
```

Secrets live only in `D:\watchvibe\.env` (git-ignored). Never put credentials, tokens or test passwords in tracked files.

## 4. Manual steps

Done (Nov 2026): `supabase/schema.sql` applied (legacy tables kept as `*_legacy`, permissive policies dropped); Site URL + redirect URLs set; leaked `vibe_tester@watchvibe.app` deleted.

Still open:
1. Enable Google / Discord in Supabase (needs OAuth client ID + secret), then set `OAUTH_ENABLED` to true in `index.html`.
2. Review leftover test users (`temp_tester_9876@watchvibe.app`, `regular@gmail.com`, `test_cinephile@gmail.com`).
3. Configure a custom SMTP provider in Supabase before real users (built-in mailer is rate-limited).
4. Optional: move the TMDB key behind a Cloudflare Worker and rotate it (it is public in `index.html`).
## 5. Phase 2 (done): Mood Picker + honest matching

- AI Vibe Matcher has multi-select moods (cry / mind-blown / laugh / cozy / adrenaline / hidden gems), a runtime filter and genre-aware scoring. Match % is relative to the best candidate; placeholder vote splits (e.g. 100/100/100) are normalised and confidence-weighted.
- Sidebar user card and Profile page show the real signed-in user and real watched/watchlist stats (the hardcoded fake persona is gone).
- Login page: green success state, 30s resend cooldown, optional display name, expired-link error handling. Google/Discord show SOON until you flip `OAUTH_ENABLED` in `index.html` after enabling the provider in Supabase.

## 6. Known gaps / roadmap

- Admin Studio analytics are local-only (localStorage); only the user list comes from Supabase (`profiles`, admin-only via RLS).
- Watchlist cloud merge is union-only (removals on one device don't propagate).
- `index.html` is ~5k lines of inline JS/CSS; split into modules with a build step when practical. Many `innerHTML` templates still interpolate TMDB strings — use `esc()` for any new/changed template.
- `media_database.json` (4 MB) is not fetched by the app; remove or wire it in.
- Flutter port: finish or delete.
- Add real PWA icons (manifest currently points to Unsplash photos).
