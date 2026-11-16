# WATCHVIBE — Deployment Guide ($0 Free Tier)

`web_live_build/` is the complete production bundle (static PWA):

- `index.html` — the whole app (HTML + CSS + JS in one file)
- `sw.js`, `manifest.json` — PWA service worker and manifest
- `_headers` — Cloudflare Pages security headers incl. Content-Security-Policy
- `media_database.json` — local title catalog (not currently fetched by `index.html`)

## Deploy (Cloudflare Pages)

```powershell
python D:\watchvibe\deploy.py
```

Requires `CLOUDFLARE_API_TOKEN` (and optionally `CLOUDFLARE_ACCOUNT_ID`) in the environment or in `D:\watchvibe\.env`
(never commit `.env`), plus `wrangler` on `PATH` (or `npx wrangler`). Live at https://watchvibe-b92.pages.dev/.

## Local preview

```powershell
cd D:\watchvibe\web_live_build
python -m http.server 8080
```

## One-time Supabase setup

1. Supabase Dashboard → SQL Editor → run `supabase/schema.sql` (tables + Row Level Security).
2. Authentication → URL Configuration: set **Site URL** to the live URL and add `http://localhost:8080` to **Redirect URLs**.
3. Authentication → Providers: enable Email (magic link), and Google / Discord if you want those buttons to work.

Netlify and Vercel configs were removed; Cloudflare Pages is the single hosting target.
