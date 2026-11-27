# WatchVibe project notes (read this first)

WatchVibe is a movie and series discovery web app (installable PWA). Live: https://watchvibe-b92.pages.dev/

## Layout
- `web_live_build/index.html`: the whole app (JavaScript inline). ~0.65 MB. Only ONE agent edits it at a time.
- `web_live_build/catalog_core.js`: the built-in catalogue (~2,060 titles) as `window.__CORE_CATALOG=[...]`, loaded by `<script src="catalog_core.js?v=N">` before the main script and cached for a year. Read and write it only through `scripts/_core.mjs` (`readCore`, `writeCore`; writeCore raises N in index.html).
- `web_live_build/games.js`: Game night (Draw the Movie, Movie Fibber, Who's the Impostor?), loaded with `?v=N` (bump N when it changes).
- `web_live_build/catalog_extra.json`: ~6,100 extra films, loaded after the first screen (`CAT.v` in index.html is its version, bump when rebuilt).
- `web_live_build/sw.js`: service worker. Bump `CACHE_NAME` (`watchvibe-cache-vNN`) on EVERY deploy.
- `web_live_build/tailwind.css`: compiled. After adding classes run `npm run build:css` (Tailwind scans index.html, admin.html, games.js).
- `functions/api/*.js`: Cloudflare Pages Functions (imdb, links, featured).
- `supabase/daily_challenge.sql`: leaderboard SQL (already applied).
- `scripts/*.mjs`: TMDB data jobs (build_catalog, add_regional, add_alt_titles, fix_runtimes). They rewrite catalogue data; run them only from the data owner.
- `tests/product-sweep.js`: full-product check. `HANDOFF.md`: running change log (append a short entry per release).
- `design/`: designer's mockups, critiques and build specs (not deployed).

## Commands
- Local server with the real security headers: a small Python server on http://127.0.0.1:8098 serving `web_live_build` and sending the CSP from `_headers`.
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

## How the team works
The user gives commands ONLY to the lead (the main session). The lead decides which teammates a job needs, creates the team, hands out the work, and reports back. Agent teams are switched on in `.claude/settings.json`.

### Roles (.claude/agents)
| Role | Model | May edit | Used for |
|---|---|---|---|
| lead (main session) | Sonnet (Opus for big or risky jobs) | index.html, games.js, anything not owned below | planning, building features and fixes |
| designer | Opus, high effort | `design/` only | new looks, UI critique, mockups, build specs |
| tester | Sonnet | nothing (reports only) | sweeps, game-room tests, regression checks |
| reviewer | Sonnet (Opus for security) | nothing (reports only) | review of a change before it ships |
| data-owner | Haiku (Sonnet if script logic changes) | scripts/, catalog_extra.json, catalog_core.js via the scripts | film data jobs |
| deployer | Opus, high effort | sw.js version, version numbers, HANDOFF.md | release, only when the lead says "ship" |

### Routing: which teammates for which job
| The user asks for | Team |
|---|---|
| Question, small fix (typo, colour, one-line change) | lead alone, no team |
| New feature or bug fix in the app | lead builds, then reviewer and tester check in parallel, then deployer ships |
| Change touching games.js, Watch together, sign-in or other players' data | lead builds, reviewer on Opus, tester plays a 3-player room, deployer ships |
| Look and feel, fonts, colours, layout ideas | designer proposes, user picks, lead builds, tester checks sizes |
| More films, language coverage, data quality | data-owner (own worktree if the lead is editing), tester runs the catalogue checks, deployer ships |
| "Check everything" or a product sweep | tester and reviewer in parallel, lead fixes what they report |
| "Ship" or "deploy" | deployer only |

### The shared task list
- At the start of a job the lead creates the task list (the team's shared task list, toggled with Ctrl+T) with one task per piece of work, each with an owner, the files it may touch, and "done" criteria. Teammates claim tasks from it, mark them done, and add tasks they discover.
- Tasks that edit the same file are chained, never parallel. Only the lead edits index.html and games.js.
- The lead also mirrors the list in the app's task list so the user sees progress without opening anything.

### Status the user can always see
- The lead starts every team job with a one-line roster: `Team: tester (Sonnet) running sweep, reviewer (Sonnet) reviewing diff, lead building`, and updates it whenever someone starts, finishes or is stopped.
- When a teammate reports, the lead summarises it in plain words (what ran, what passed, what failed, what could not be checked) before acting.
- At the end the lead gives one report: what changed, which teammates did what, version numbers, what was not verified.
- The user can open any running teammate (Up/Down arrows on the agent panel, Enter) and message it, but does not have to.

### Rules for the lead
- Start the smallest team that does the job; skip the team for small fixes (each teammate is a full session and uses usage).
- Give every teammate a narrow brief: files, goal, "report only" where that applies, what done looks like.
- Never let two teammates edit the same file. Tester and reviewer never edit. Never deploy without the deployer's checklist passing and the user having asked for the release.
- Stop and shut down teammates when their task is finished.
