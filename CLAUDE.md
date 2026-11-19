# WatchVibe project notes (read this first)

WatchVibe is a movie and series discovery web app (installable PWA). Live: https://watchvibe-b92.pages.dev/

## Layout
- `web_live_build/index.html`: the whole app (JavaScript inline, built-in catalogue of ~2,060 titles inside). ~2.6 MB. Only ONE agent edits it at a time.
- `web_live_build/games.js`: Game night (Draw the Movie, Movie Fibber, Who's the Impostor?), loaded with `?v=N` (bump N when it changes).
- `web_live_build/catalog_extra.json`: ~6,100 extra films, loaded after the first screen (`CAT.v` in index.html is its version, bump when rebuilt).
- `web_live_build/sw.js`: service worker. Bump `CACHE_NAME` (`watchvibe-cache-vNN`) on EVERY deploy.
- `web_live_build/tailwind.css`: compiled. After adding classes run `npm run build:css` (Tailwind scans index.html, admin.html, games.js).
- `functions/api/*.js`: Cloudflare Pages Functions (imdb, links, featured).
- `supabase/daily_challenge.sql`: leaderboard SQL (already applied).
- `scripts/*.mjs`: TMDB data jobs (build_catalog, add_regional, add_alt_titles, fix_runtimes). They rewrite catalogue data; run them only from the data owner.
- `tests/product-sweep.js`: full-product check. `HANDOFF.md`: running change log (append a short entry per release).

## Commands
- Local server with the real security headers: `python -X utf8 hdrserver.py` style server on http://127.0.0.1:8098 serving `web_live_build` (copy of the CSP from `_headers`).
- Syntax check: extract the two inline `<script>` blocks of index.html and run `node --check`; also `node --check web_live_build/games.js`.
- Deploy: `python deploy.py` (rebuilds CSS, deploys to Cloudflare Pages). Then `git add -A; git commit; git push`.
- Commit messages end with the Co-Authored-By line given by the session.

## Rules that must not be broken
1. NEVER put text that came from another player or device into an `onclick="..."` string or any HTML without `esc()`. Use `data-*` attributes plus a delegated handler (see `gnClick` in games.js).
2. Anything received from other devices (Watch together, game rooms) must be validated before use (`wtSafeItem`, `wtSafeState`, `gnCleanState`).
3. Never invent data: unknown runtime or director stays blank.
4. The site's CSP blocks `eval`; test files are loaded as script tags from the site, not pasted into eval.
5. Daily Challenge questions must be identical for all players: they wait for `catalog_extra.json` (`dcReady`).
6. Keep every page free of sideways scrolling at 375, 768 and 1440 px.
7. Do not enter credentials or sign in for the user; they do that themselves.

## Definition of done for any change
syntax check passes, `npm run build:css`, `await runProductSweep()` shows `problems: []` at 375/768/1440, `sw.js` cache version bumped, deployed, checked live, HANDOFF.md entry, committed and pushed.

## Team roles (.claude/agents)
- lead: the only one who edits index.html and games.js.
- tester, reviewer: read-only reports (tester Sonnet, reviewer Sonnet; use Opus for the reviewer on security changes).
- designer: writes only inside design/ (mockups, critiques, build specs).
- data-owner: scripts/ and the film data files only (Haiku; Sonnet when changing script logic).`n- deployer (Opus, high effort): runs the checklist, deploys only on the lead saying "ship", verifies live, writes the HANDOFF entry. May edit only sw.js, version numbers and HANDOFF.md.`n- designer (Opus, high effort).
