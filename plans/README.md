# Animation plans for WatchVibe

Written by the improve-animations audit at commit 5a97c9d. Each plan is self-contained. Source code was not changed by the audit.

| # | Title | Severity | Status |
|---|---|---|---|
| 001 | Stop the featured-film text replaying its entrance on every poster hover | HIGH | DONE (v158) |
| 002 | Limit hover effects to devices that really hover | MEDIUM | DONE (v158) |
| 003 | Give the streak banner a fast exit curve | MEDIUM | DONE (v158) |
| 004 | Add press feedback to buttons and chips | MEDIUM | DONE (v158) |
| 005 | Shorten the star-card photo zoom on hover | LOW | DONE (v158) |
| 006 | Batch the poster-tilt updates to once per frame | LOW | DONE (v158) |
| 007 | Turn the repeated easing curves into shared tokens | LOW | DONE (v158) |
| 008 | Stop holding `will-change` on the film window after it opens | LOW | DONE (v158) |

## Order

1. 001 (biggest feel win), then 002.
2. 003, 004, 005 (small, independent). All touch `swiss.css`, so do them one after another, not in parallel.
3. 007 last among CSS plans: it renames the curves that 003, 004 and 005 use. Do it after them.
4. 008 and 006 are independent of the rest (008 is swiss.css, 006 is index.html).

## Dependencies

- 007 depends on 003, 004, 005 (and optionally 008).
- 001 and 006 edit `index.html`; the project rule is that only one agent edits `index.html` at a time.
- Every plan that edits swiss.css ends with the same release steps: bump `swiss.css?v=N` in index.html and `CACHE_NAME` in `sw.js`; run the syntax check, the product sweep at 375, 768 and 1440 px, deploy and check live.

## Not turned into plans

Missed opportunities from the audit, additive and optional: a short exit for the film window, a fade-out for "Pick for me tonight", and a small confirming motion when adding to the watchlist.
